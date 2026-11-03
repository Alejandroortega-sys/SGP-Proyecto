import { expect, test, type Page } from "@playwright/test";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  campo,
  iniciarSesion,
  tokenSesion,
} from "./helpers";
import { eliminarZonasPrueba } from "./limpieza-zonas";

const PREFIJO = "E2E Zonas";
const CENTRO = { lat: 4.0847, lng: -76.1954 };
const ZOOM = 15;

const TESELA_TRANSPARENTE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const CUADRADO_VALIDO: Array<[number, number]> = [
  [-76.2045, 4.0785],
  [-76.2015, 4.0785],
  [-76.2015, 4.081],
  [-76.2045, 4.081],
];

const BOWTIE: Array<[number, number]> = [
  [-76.2045, 4.0785],
  [-76.2015, 4.081],
  [-76.2045, 4.081],
  [-76.2015, 4.0785],
];

interface FeatureZona {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: { id: string; nombre: string; tipo: string };
}

interface CuerpoGeoJson {
  features: FeatureZona[];
}

interface DetalleZona {
  id: string;
  nombre: string;
  tipo: string;
  activa: boolean;
  horarioInicio: string | null;
  horarioFin: string | null;
  aforoMaximo: number | null;
  productosPermitidos: Array<{ id: string; nombre: string }>;
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

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function proyectar(lat: number, lng: number): { x: number; y: number } {
  const escala = 256 * 2 ** ZOOM;
  const x = ((lng + 180) / 360) * escala;
  const seno = Math.sin((lat * Math.PI) / 180);
  const y =
    (0.5 -
      Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) *
    escala;
  return { x, y };
}

async function cajaDelMapa(page: Page) {
  const mapa = page.getByLabel("Mapa para dibujar el polígono de la zona");
  await expect(mapa).toBeVisible();
  await mapa.scrollIntoViewIfNeeded();

  await expect
    .poll(
      async () => page.locator(".leaflet-overlay-pane path").count(),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  const caja = await mapa.boundingBox();
  if (!caja) throw new Error("El mapa del editor no tiene dimensiones.");
  return caja;
}

async function clicEnCoordenada(
  page: Page,
  caja: { x: number; y: number; width: number; height: number },
  lng: number,
  lat: number,
): Promise<void> {
  const centro = proyectar(CENTRO.lat, CENTRO.lng);
  const punto = proyectar(lat, lng);
  await page.mouse.click(
    caja.x + caja.width / 2 + (punto.x - centro.x),
    caja.y + caja.height / 2 + (punto.y - centro.y),
  );
}

async function dibujarPoligono(
  page: Page,
  coordenadas: Array<[number, number]>,
): Promise<void> {
  const caja = await cajaDelMapa(page);
  for (const [lng, lat] of coordenadas) {
    await clicEnCoordenada(page, caja, lng, lat);
  }

  await expect(
    page.getByText(new RegExp(`${coordenadas.length} vértices`)).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar polígono" }).click();
}

async function abrirEditorNuevaZona(page: Page): Promise<void> {
  await page.goto("/gestor/zonas/nueva");
  await expect(
    page.getByRole("heading", {
      name: "Delimitar y clasificar una zona",
    }),
  ).toBeVisible();
  await cajaDelMapa(page);
}

async function obtenerGeoJson(): Promise<CuerpoGeoJson> {
  const respuesta = await fetch(`${API_URL}/zonas/geojson`);
  expect(respuesta.ok).toBeTruthy();
  return (await respuesta.json()) as CuerpoGeoJson;
}

function cuadradoDentroDe(feature: FeatureZona): Array<[number, number]> {
  const anillo = feature.geometry.coordinates[0].slice(0, -1);
  const lngs = anillo.map(([lng]) => lng);
  const lats = anillo.map(([, lat]) => lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const x1 = minLng + (maxLng - minLng) * 0.35;
  const x2 = minLng + (maxLng - minLng) * 0.65;
  const y1 = minLat + (maxLat - minLat) * 0.35;
  const y2 = minLat + (maxLat - minLat) * 0.65;

  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
}

function cuerpoZona(
  nombre: string,
  coordenadas: Array<[number, number]>,
): Record<string, unknown> {
  return {
    nombre,
    tipo: "permitida",
    geometria: {
      type: "Polygon",
      coordinates: [
        [...coordenadas, coordenadas[0]].map(([lng, lat]) => [lng, lat]),
      ],
    },
    horarioInicio: "08:00",
    horarioFin: "17:00",
    aforoMaximo: 25,
    productosPermitidos: ["1", "2"],
  };
}

async function mensajeDeError(respuesta: {
  json: () => Promise<unknown>;
}): Promise<string> {
  const cuerpo = (await respuesta.json()) as {
    message?: string | string[];
  };
  if (Array.isArray(cuerpo.message)) return cuerpo.message.join(" ");
  return cuerpo.message ?? "";
}

test.describe("Zonas del gestor municipal (HU-11)", () => {
  test.afterAll(async () => {
    await eliminarZonasPrueba(PREFIJO);
  });

  test.beforeEach(async ({ page }) => {
    await bloquearTeselas(page);
  });

  test("crea, edita y desactiva una zona desde la interfaz", async ({
    page,
    request,
  }) => {
    const nombre = `${PREFIJO} UI ${Date.now()}`;
    const nombreEditado = `${nombre} editada`;

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );

    await abrirEditorNuevaZona(page);
    await dibujarPoligono(page, CUADRADO_VALIDO);

    await expect(
      page.getByText(
        "La geometría es válida y no se solapa con ninguna zona activa.",
      ),
    ).toBeVisible();

    await campo(page, "Nombre de la zona").fill(nombre);
    await campo(page, "Tipo de zona").selectOption("permitida");
    await campo(page, "Hora de inicio").fill("08:00");
    await campo(page, "Hora de fin").fill("17:00");
    await campo(page, "Aforo máximo").fill("25");
    await page.getByRole("checkbox", { name: "Frutas frescas" }).check();

    await page.getByRole("button", { name: "Crear zona" }).click();
    await page.waitForURL(/\/gestor\/zonas\/\d+\/editar/);
    await expect(
      page.getByText(
        "La zona se creó correctamente y ya está publicada en el mapa.",
      ),
    ).toBeVisible();

    const id = new URL(page.url()).pathname.split("/")[3] ?? "";
    expect(id).toMatch(/^\d+$/);

    const token = await tokenSesion(page);
    const respuestaDetalle = await request.get(
      `${API_URL}/zonas/${id}`,
      cabecerasApi(token),
    );
    expect(respuestaDetalle.ok()).toBeTruthy();
    let detalle = (await respuestaDetalle.json()) as DetalleZona;
    expect(detalle).toMatchObject({
      nombre,
      tipo: "permitida",
      activa: true,
      horarioInicio: "08:00",
      horarioFin: "17:00",
      aforoMaximo: 25,
    });
    expect(
      detalle.productosPermitidos.some(
        (producto) => producto.nombre === "Frutas frescas",
      ),
    ).toBe(true);

    const geojson = await obtenerGeoJson();
    expect(
      geojson.features.some(
        (feature) => feature.properties.nombre === nombre,
      ),
    ).toBe(true);

    // Edición con vista previa y guardado.
    await page.goto(`/gestor/zonas/${id}/editar`);
    await cajaDelMapa(page);

    // Edición de vértices con vista previa: se elimina uno de los cuatro.
    const vertices = page.locator(".sgp-vertice-zona");
    await expect(vertices).toHaveCount(4);
    await vertices.first().click();
    await expect(
      page.getByText(/3 vértices/).first(),
    ).toBeVisible();

    await campo(page, "Nombre de la zona").fill(nombreEditado);
    await campo(page, "Tipo de zona").selectOption("restringida");
    await campo(page, "Aforo máximo").fill("30");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Los cambios se guardaron correctamente."),
    ).toBeVisible();

    const detalleEditado = await request.get(
      `${API_URL}/zonas/${id}`,
      cabecerasApi(token),
    );
    detalle = (await detalleEditado.json()) as DetalleZona;
    expect(detalle).toMatchObject({
      nombre: nombreEditado,
      tipo: "restringida",
      aforoMaximo: 30,
      horarioInicio: "08:00",
      horarioFin: "17:00",
    });

    // Historial de la zona: creación + edición con actor y cambios.
    const historialApi = await request.get(
      `${API_URL}/zonas/${id}/historial`,
      cabecerasApi(token),
    );
    expect(historialApi.ok()).toBeTruthy();
    const historial = (await historialApi.json()) as {
      datos: Array<{
        version: number;
        accion: string;
        actor: { correo: string } | null;
        cambios: Array<{ campo: string }>;
      }>;
    };
    expect(historial.datos.map((version) => version.accion)).toEqual([
      "edicion",
      "creacion",
    ]);
    expect(historial.datos[0].actor?.correo).toBe(
      CREDENCIALES.administrador.correo,
    );
    expect(
      historial.datos[0].cambios.map((cambio) => cambio.campo),
    ).toEqual(
      expect.arrayContaining([
        "nombre",
        "tipo",
        "aforoMaximo",
        "geometria",
      ]),
    );

    await page.goto(`/gestor/zonas/${id}/historial`);
    await expect(
      page.getByRole("heading", { name: /Historial de/ }),
    ).toBeVisible();
    await expect(page.getByText("v2", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Zona editada", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(CREDENCIALES.administrador.correo).first(),
    ).toBeVisible();
    await expect(
      page.getByLabel("Mapa de comparación de versiones de la zona"),
    ).toBeVisible();

    // Baja lógica con confirmación.
    await page.goto("/gestor/zonas");
    await campo(page, "Buscar").fill(nombreEditado);
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    const fila = page.getByRole("row", {
      name: new RegExp(escaparRegex(nombreEditado)),
    });
    await expect(fila).toBeVisible();
    await fila.getByRole("button", { name: "Desactivar" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Desactivar", exact: true })
      .click();

    await expect(
      page.getByText("Zona desactivada.", { exact: true }),
    ).toBeVisible();

    const detalleInactivo = await request.get(
      `${API_URL}/zonas/${id}`,
      cabecerasApi(token),
    );
    detalle = (await detalleInactivo.json()) as DetalleZona;
    expect(detalle.activa).toBe(false);

    const geojsonFinal = await obtenerGeoJson();
    expect(
      geojsonFinal.features.some(
        (feature) => feature.properties.nombre === nombreEditado,
      ),
    ).toBe(false);

    // La desactivación también queda versionada y el histórico sigue visible.
    await page.goto(`/gestor/zonas/${id}/historial`);
    await expect(
      page.getByText("Zona desactivada", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("v3", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Estado", { exact: true }).first(),
    ).toBeVisible();
  });

  test("la API real rechaza geometrías válidas, autointersectadas y solapadas", async ({
    page,
    request,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    const token = await tokenSesion(page);
    const cabeceras = cabecerasApi(token);

    const nombreValido = `${PREFIJO} API ${Date.now()}`;
    const valida = await request.post(`${API_URL}/zonas`, {
      ...cabeceras,
      data: cuerpoZona(nombreValido, CUADRADO_VALIDO),
    });
    expect(valida.status()).toBe(201);
    const creada = (await valida.json()) as DetalleZona;
    expect(creada.nombre).toBe(nombreValido);

    const autointersectada = await request.post(`${API_URL}/zonas`, {
      ...cabeceras,
      data: cuerpoZona(`${nombreValido} bowtie`, BOWTIE),
    });
    expect(autointersectada.status()).toBe(422);
    expect(await mensajeDeError(autointersectada)).toMatch(
      /autointersecta|inválida/i,
    );

    const geojson = await obtenerGeoJson();
    const existente = geojson.features.find(
      (feature) => feature.properties.nombre === "Centro - Calle 30",
    );
    expect(existente).toBeTruthy();

    const solapada = await request.post(`${API_URL}/zonas`, {
      ...cabeceras,
      data: cuerpoZona(
        `${nombreValido} solapada`,
        cuadradoDentroDe(existente as FeatureZona),
      ),
    });
    expect(solapada.status()).toBe(422);
    expect(await mensajeDeError(solapada)).toMatch(/solapa/i);
  });

  test("el editor avisa antes de guardar autointersecciones y solapes", async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );

    // Autointersección: el botón de guardar queda deshabilitado.
    await abrirEditorNuevaZona(page);
    await dibujarPoligono(page, BOWTIE);
    await expect(
      page.getByText(/El polígono se cruza a sí mismo/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Crear zona" }),
    ).toBeDisabled();

    // Solape con una zona activa existente.
    const geojson = await obtenerGeoJson();
    const existente = geojson.features.find(
      (feature) => feature.properties.nombre === "Centro - Calle 30",
    );
    expect(existente).toBeTruthy();

    await abrirEditorNuevaZona(page);
    await dibujarPoligono(page, cuadradoDentroDe(existente as FeatureZona));
    await expect(
      page.getByText(/La zona se solapa con «Centro - Calle 30»/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Crear zona" }),
    ).toBeDisabled();
  });

  test("el revisor consulta las zonas en modo lectura", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );

    await page.goto("/gestor/zonas");
    await expect(
      page.getByRole("heading", { name: "Zonas del espacio público" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Crear zona" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("row", { name: /Centro - Calle 30/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Desactivar" }),
    ).toHaveCount(0);

    await page.goto("/gestor/zonas/nueva");
    await expect(
      page.getByText("Solo el administrador puede crear zonas"),
    ).toBeVisible();

    await page.goto("/gestor/zonas/1/editar");
    await expect(
      page.getByText(/Estás viendo la zona en modo lectura/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Guardar cambios" }),
    ).toHaveCount(0);

    await page.goto("/gestor/zonas/1/historial");
    await expect(
      page.getByRole("heading", { name: /Historial de/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Editar zona" }),
    ).toHaveCount(0);
  });
});
