import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  API_URL,
  CREDENCIALES,
  campo,
  iniciarSesion,
  tokenSesion,
} from "./helpers";
import { eliminarModulosPrueba } from "./limpieza-modulos";

const PREFIJO = "E2E Módulos";
const CENTRO = { lat: 4.0847, lng: -76.1954 };
const ZOOM = 16;

const TESELA_TRANSPARENTE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

interface FeatureZona {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: { id: string; nombre: string; tipo: string };
}

interface CuerpoGeoJson {
  features: FeatureZona[];
}

async function bloquearTeselas(page: Page): Promise<void> {
  await page.route("https://*.tile.openstreetmap.org/**", (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: "image/png",
      body: TESELA_TRANSPARENTE,
    }),
  );
}

function proyectar(
  lat: number,
  lng: number,
  zoom = ZOOM,
): { x: number; y: number } {
  const escala = 256 * 2 ** zoom;
  const x = ((lng + 180) / 360) * escala;
  const seno = Math.sin((lat * Math.PI) / 180);
  const y =
    (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * escala;
  return { x, y };
}

async function cajaDelMapa(page: Page) {
  const mapa = page.getByLabel("Mapa para seleccionar el punto del módulo");
  await expect(mapa).toBeVisible();
  await mapa.scrollIntoViewIfNeeded();
  await expect
    .poll(
      async () => page.locator(".leaflet-overlay-pane path").count(),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  const caja = await mapa.boundingBox();
  if (!caja) throw new Error("El mapa del censo no tiene dimensiones.");
  return caja;
}

async function clicEnCoordenada(
  page: Page,
  caja: { x: number; y: number; width: number; height: number },
  lng: number,
  lat: number,
  zoom = ZOOM,
): Promise<void> {
  const centro = proyectar(CENTRO.lat, CENTRO.lng, zoom);
  const punto = proyectar(lat, lng, zoom);
  await page.mouse.click(
    caja.x + caja.width / 2 + (punto.x - centro.x),
    caja.y + caja.height / 2 + (punto.y - centro.y),
  );
}

async function alejarMapa(page: Page, veces: number): Promise<void> {
  for (let indice = 0; indice < veces; indice += 1) {
    await page.locator(".leaflet-control-zoom-out").click();
    await page.waitForTimeout(500);
  }
}

function centroDeZona(feature: FeatureZona): { lat: number; lng: number } {
  const anillo = feature.geometry.coordinates[0].slice(0, -1);
  const lng = anillo.reduce((total, [valor]) => total + valor, 0) / anillo.length;
  const lat = anillo.reduce((total, [, valor]) => total + valor, 0) / anillo.length;
  return { lat, lng };
}

async function obtenerZona(nombre: string): Promise<FeatureZona> {
  const respuesta = await fetch(`${API_URL}/zonas/geojson`);
  expect(respuesta.ok).toBeTruthy();
  const cuerpo = (await respuesta.json()) as CuerpoGeoJson;
  const feature = cuerpo.features.find(
    (candidata) => candidata.properties.nombre === nombre,
  );
  if (!feature) throw new Error(`No se encontró la zona ${nombre}.`);
  return feature;
}

async function abrirNuevoModulo(page: Page): Promise<void> {
  await page.goto("/gestor/modulos/nuevo");
  await expect(
    page.getByRole("heading", { name: "Censar un módulo o puesto" }),
  ).toBeVisible();
  await cajaDelMapa(page);
}

async function llenarFormularioBasico(
  page: Page,
  actividad: string,
  categoria: "formal" | "informal" = "informal",
): Promise<void> {
  await campo(page, "Categoría").selectOption(categoria);
  await campo(page, "Actividad").fill(actividad);
  await campo(page, "Nombre del titular").fill("Titular E2E");
}

async function crearModuloApi(
  request: APIRequestContext,
  token: string,
  actividad: string,
  punto: { lat: number; lng: number },
) {
  const respuesta = await request.post(`${API_URL}/modulos`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      categoria: "informal",
      actividad,
      ubicacion: JSON.stringify({
        type: "Point",
        coordinates: [punto.lng, punto.lat],
      }),
      titularNombre: "Titular E2E",
    },
  });
  expect(respuesta.status()).toBe(201);
  return (await respuesta.json()) as { id: string; codigo: string };
}

test.describe("Censo de módulos y puestos (HU-13)", () => {
  test.afterAll(async () => {
    await eliminarModulosPrueba(PREFIJO);
  });

  test.beforeEach(async ({ page }) => {
    await bloquearTeselas(page);
  });

  test("censa un módulo con punto, titular y foto, y muestra la ficha", async ({
    page,
  }) => {
    const actividad = `${PREFIJO} alta ${Date.now()}`;
    const zona = await obtenerZona("Centro - Calle 30");
    const centro = centroDeZona(zona);

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );

    await abrirNuevoModulo(page);
    await llenarFormularioBasico(page, actividad);
    await page
      .getByLabel(/Foto del puesto/)
      .setInputFiles({ name: "puesto.png", mimeType: "image/png", buffer: PNG });

    const caja = await cajaDelMapa(page);
    await clicEnCoordenada(page, caja, centro.lng, centro.lat);

    await expect(page.getByText("Centro - Calle 30").first()).toBeVisible();
    await expect(
      page.getByText("El punto está en una zona restringida"),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Censar módulo" }).click();
    await page.waitForURL(/\/gestor\/modulos\/\d+/);

    await expect(
      page.getByText("El módulo se censó correctamente."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /MOD-\d+/ }),
    ).toBeVisible();
    await expect(page.getByAltText(/Foto del módulo/)).toBeVisible();
    await expect(page.getByText("Centro - Calle 30").first()).toBeVisible();
    await expect(page.getByText("Historial")).toBeVisible();
    await expect(page.getByText("Módulo censado")).toBeVisible();
  });

  test("advierte y exige confirmación en zona restringida", async ({ page }) => {
    const actividad = `${PREFIJO} restringida ${Date.now()}`;
    const zona = await obtenerZona("Entorno Hospital");
    const centro = centroDeZona(zona);

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );

    await abrirNuevoModulo(page);
    await llenarFormularioBasico(page, actividad, "formal");

    // Entorno Hospital queda al norte del centro inicial; se aleja el mapa
    // para que el punto quede dentro del área visible.
    await alejarMapa(page, 2);
    const caja = await cajaDelMapa(page);
    await clicEnCoordenada(page, caja, centro.lng, centro.lat, ZOOM - 2);

    await expect(
      page.getByText(/El punto está en la zona restringida/).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Censar módulo" }),
    ).toBeDisabled();

    await page
      .getByRole("checkbox", {
        name: /Entiendo que el punto está en una zona restringida/,
      })
      .check();

    await expect(
      page.getByRole("button", { name: "Censar módulo" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Censar módulo" }).click();
    await page.waitForURL(/\/gestor\/modulos\/\d+/);
    await expect(
      page.getByText(/El punto está en la zona restringida/).first(),
    ).toBeVisible();
  });

  test("rechaza fotos de tipo inválido y mayores a 5 MB", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );

    await abrirNuevoModulo(page);
    await llenarFormularioBasico(page, `${PREFIJO} foto ${Date.now()}`);
    await page
      .getByLabel(/Foto del puesto/)
      .setInputFiles({
        name: "falsa.png",
        mimeType: "image/png",
        buffer: Buffer.from("esto no es una imagen"),
      });

    const caja = await cajaDelMapa(page);
    const centro = centroDeZona(await obtenerZona("Centro - Calle 30"));
    await clicEnCoordenada(page, caja, centro.lng, centro.lat);

    await page.getByRole("button", { name: "Censar módulo" }).click();
    await expect(
      page.getByText(/El contenido del archivo no corresponde/),
    ).toBeVisible();

    await page
      .getByLabel(/Foto del puesto/)
      .setInputFiles({
        name: "grande.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      });
    await expect(
      page.getByText("La foto no puede superar 5 MB.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Censar módulo" }),
    ).toBeDisabled();
  });

  test("filtra por sector y categoría, da de baja y reactiva", async ({
    page,
    request,
  }) => {
    const actividad = `${PREFIJO} filtros ${Date.now()}`;
    const zona = await obtenerZona("Centro - Calle 30");
    const centro = centroDeZona(zona);

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    const token = await tokenSesion(page);
    const creado = await crearModuloApi(request, token, actividad, centro);

    await page.goto("/gestor/modulos");
    await campo(page, "Buscar").fill(actividad);
    await campo(page, "Categoría").selectOption("informal");
    await campo(page, "Sector").selectOption("Centro - Calle 30");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    const fila = page.getByRole("row", { name: new RegExp(actividad) });
    await expect(fila).toBeVisible();
    await expect(fila.getByText("Centro - Calle 30")).toBeVisible();

    await fila.getByRole("button", { name: "Dar de baja" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Dar de baja", exact: true })
      .click();
    await expect(page.getByText("Módulo dado de baja.")).toBeVisible();

    await campo(page, "Estado").selectOption("baja");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(actividad) }),
    ).toBeVisible();

    const filaBaja = page.getByRole("row", { name: new RegExp(actividad) });
    await filaBaja.getByRole("button", { name: "Reactivar" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Reactivar", exact: true })
      .click();
    await expect(page.getByText("Módulo reactivado.")).toBeVisible();

    await page.goto(`/gestor/modulos/${creado.id}/editar`);
    await expect(
      page.getByRole("heading", { name: "Editar módulo" }),
    ).toBeVisible();
    await campo(page, "Actividad").fill(`${actividad} editada`);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Los cambios se guardaron correctamente."),
    ).toBeVisible();
  });

  test("el revisor también puede censar y el listado se adapta a 360 px", async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );

    await page.goto("/gestor/modulos");
    await expect(
      page.getByRole("link", { name: "Censar módulo" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Censar módulo" }).click();
    await expect(
      page.getByRole("heading", { name: "Censar un módulo o puesto" }),
    ).toBeVisible();

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/gestor/modulos");
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(desborde).toBeLessThanOrEqual(1);
  });
});
