import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import {
  API_URL,
  CREDENCIALES,
  campo,
  iniciarSesion,
  tokenSesion,
} from "./helpers";
import { eliminarEspaciosPrueba } from "./limpieza-espacios";

const PREFIJO = "E2E Espacios";
const PUNTO = { lat: 4.089, lng: -76.195 };

const TESELA_TRANSPARENTE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function bloquearTeselas(page: Page): Promise<void> {
  await page.route("https://*.tile.openstreetmap.org/**", (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: "image/png",
      body: TESELA_TRANSPARENTE,
    }),
  );
}

async function cajaDelMapa(page: Page) {
  const mapa = page.getByLabel("Mapa para seleccionar la ubicación del espacio");
  await expect(mapa).toBeVisible();
  await mapa.scrollIntoViewIfNeeded();
  await expect
    .poll(
      async () => page.locator(".leaflet-overlay-pane path").count(),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  const caja = await mapa.boundingBox();
  if (!caja) throw new Error("El mapa del espacio no tiene dimensiones.");
  return caja;
}

async function crearEspacioApi(
  request: APIRequestContext,
  token: string,
  nombre: string,
): Promise<{ id: string; nombre: string }> {
  const respuesta = await request.post(`${API_URL}/gestor/espacios`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      nombre,
      tipo: "puesto",
      sector: "Centro - Calle 30",
      dimensiones: "4 × 3 m",
      actividadPermitida: "Comidas rápidas",
      ubicacion: {
        type: "Point",
        coordinates: [PUNTO.lng, PUNTO.lat],
      },
      horarioInicio: "07:00",
      horarioFin: "17:00",
    },
  });
  expect(respuesta.status()).toBe(201);
  return (await respuesta.json()) as { id: string; nombre: string };
}

async function irADetalle(page: Page, id: string): Promise<void> {
  await page.goto(`/gestor/espacios/${id}`);
  await expect(
    page.getByRole("heading", { name: /E2E Espacios/ }),
  ).toBeVisible();
}

test.describe("Administración de espacios temporales (HU-15)", () => {
  test.afterAll(async () => {
    await eliminarEspaciosPrueba(PREFIJO);
  });

  test.beforeEach(async ({ page }) => {
    await bloquearTeselas(page);
  });

  test("crea un espacio desde el formulario, lo edita y lo elimina", async ({
    page,
  }) => {
    const nombre = `${PREFIJO} alta ${Date.now()}`;
    const nombreEditado = `${nombre} editado`;

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );

    await page.goto("/gestor/espacios/nuevo");
    await expect(
      page.getByRole("heading", { name: "Crear espacio temporal" }),
    ).toBeVisible();

    await campo(page, "Nombre").fill(nombre);
    await campo(page, "Tipo de espacio").selectOption("puesto");
    await campo(page, "Dimensiones").fill("4 × 3 m");
    await campo(page, "Actividad permitida").fill("Comidas rápidas");
    await campo(page, "Horario desde").fill("07:00");
    await campo(page, "Horario hasta").fill("17:00");

    const caja = await cajaDelMapa(page);
    const mapa = page.getByLabel("Mapa para seleccionar la ubicación del espacio");
    await mapa.click({
      position: { x: caja.width / 2, y: caja.height / 2 },
    });
    await expect(page.locator(".sgp-marcador-modulo")).toBeVisible();
    await campo(page, "Sector").fill("Centro - Calle 30");

    await page.getByRole("button", { name: "Crear espacio" }).click();
    await page.waitForURL(/\/gestor\/espacios\/\d+/);
    await expect(
      page.getByText("El espacio se creó correctamente."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: nombre })).toBeVisible();

    await page.getByRole("link", { name: "Editar" }).click();
    await expect(
      page.getByRole("heading", { name: "Editar espacio temporal" }),
    ).toBeVisible();
    await campo(page, "Nombre").first().fill(nombreEditado);
    await page.getByRole("button", { name: "Guardar cambios" }).first().click();
    await expect(
      page.getByText("Los cambios se guardaron correctamente."),
    ).toBeVisible();

    await page.goto("/gestor/espacios");
    await campo(page, "Buscar").fill(nombreEditado);
    await page.getByRole("button", { name: "Aplicar" }).click();
    const fila = page.getByRole("row", { name: new RegExp(nombreEditado) });
    await expect(fila).toBeVisible();
    await fila.getByRole("button", { name: "Eliminar" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar espacio", exact: true })
      .click();
    await expect(page.getByText(/se eliminó/)).toBeVisible();
  });

  test("gestiona bloqueos con calendario y rechaza solapes", async ({
    page,
    request,
  }) => {
    const nombre = `${PREFIJO} bloqueos ${Date.now()}`;
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    const token = await tokenSesion(page);
    const espacio = await crearEspacioApi(request, token, nombre);
    await irADetalle(page, espacio.id);

    await page.getByRole("button", { name: "Nuevo bloqueo" }).click();
    await campo(page, "Fecha de inicio").fill("2026-12-20");
    await campo(page, "Fecha de fin").fill("2026-12-24");
    await campo(page, "Motivo").fill("Evento navideño");
    await page.getByRole("button", { name: "Crear bloqueo" }).click();

    await expect(
      page.getByText("El bloqueo se creó correctamente."),
    ).toBeVisible();
    await expect(page.getByText("Evento navideño").first()).toBeVisible();

    await page.getByRole("button", { name: "Nuevo bloqueo" }).click();
    await campo(page, "Fecha de inicio").fill("2026-12-22");
    await campo(page, "Fecha de fin").fill("2026-12-26");
    await page.getByRole("button", { name: "Crear bloqueo" }).click();
    await expect(
      page.getByText("Ya existe un bloqueo que se cruza con esas fechas."),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Editar" })
      .last()
      .click();
    await campo(page, "Motivo").fill("Evento actualizado");
    await page.getByRole("button", { name: "Guardar bloqueo" }).click();
    await expect(
      page.getByText("El bloqueo se actualizó correctamente."),
    ).toBeVisible();
    await expect(page.getByText("Evento actualizado").first()).toBeVisible();

    await page
      .getByRole("button", { name: "Eliminar", exact: true })
      .last()
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar bloqueo", exact: true })
      .click();
    await expect(
      page.getByText("El bloqueo se eliminó correctamente."),
    ).toBeVisible();
  });

  test("asigna, libera y cambia el mantenimiento desde la ficha", async ({
    page,
    request,
  }) => {
    const nombre = `${PREFIJO} estados ${Date.now()}`;
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    const token = await tokenSesion(page);
    const espacio = await crearEspacioApi(request, token, nombre);
    await irADetalle(page, espacio.id);

    await page.getByRole("button", { name: "Asignar espacio" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Asignar", exact: true })
      .click();
    await expect(
      page.getByText("Espacio asignado manualmente."),
    ).toBeVisible();
    await expect(
      page.getByText("Asignación manual", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Liberar asignación" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Liberar", exact: true })
      .click();
    await expect(page.getByText("Espacio liberado.")).toBeVisible();

    await page
      .getByRole("button", { name: "Poner en mantenimiento" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Poner en mantenimiento", exact: true })
      .click();
    await expect(
      page.getByText("Espacio puesto en mantenimiento."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Volver a disponible" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Volver a disponible", exact: true })
      .click();
    await expect(page.getByText("Espacio disponible.")).toBeVisible();
  });

  test("el revisor también administra y la vista no desborda a 360 px", async ({
    page,
    request,
  }) => {
    const nombre = `${PREFIJO} revisor ${Date.now()}`;
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    const token = await tokenSesion(page);
    const espacio = await crearEspacioApi(request, token, nombre);

    await page.goto("/gestor/espacios");
    await expect(
      page.getByRole("link", { name: "Crear espacio" }),
    ).toBeVisible();

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/gestor/espacios/${espacio.id}`);
    await expect(
      page.getByRole("heading", { name: nombre }),
    ).toBeVisible();

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(desborde).toBeLessThanOrEqual(1);
  });

  test("actualiza el estado al crear y eliminar un bloqueo vigente", async ({
    page,
    request,
  }) => {
    const nombre = `${PREFIJO} estado bloqueo ${Date.now()}`;
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    const token = await tokenSesion(page);
    const espacio = await crearEspacioApi(request, token, nombre);
    const fecha = new Date();
    const hoy = [
      fecha.getFullYear(),
      String(fecha.getMonth() + 1).padStart(2, "0"),
      String(fecha.getDate()).padStart(2, "0"),
    ].join("-");

    const bloqueo = await request.post(
      `${API_URL}/gestor/espacios/${espacio.id}/bloqueos`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { fechaInicio: hoy, fechaFin: hoy, motivo: "Bloqueo vigente" },
      },
    );
    expect(bloqueo.status()).toBe(201);
    const creado = (await bloqueo.json()) as { id: string };

    const conBloqueo = await request.get(
      `${API_URL}/gestor/espacios/${espacio.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(conBloqueo.ok()).toBeTruthy();
    expect((await conBloqueo.json()) as { estado: string }).toMatchObject({
      estado: "bloqueado",
    });

    const eliminado = await request.delete(
      `${API_URL}/gestor/espacios/${espacio.id}/bloqueos/${creado.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(eliminado.status()).toBe(204);

    const sinBloqueo = await request.get(
      `${API_URL}/gestor/espacios/${espacio.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect((await sinBloqueo.json()) as { estado: string }).toMatchObject({
      estado: "disponible",
    });
  });

  test("rechaza bloquear un espacio con un permiso vigente", async ({
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
    const zona = await request.get(
      `${API_URL}/gestor/espacios/zona-contenedora?lat=${PUNTO.lat}&lng=${PUNTO.lng}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(zona.ok()).toBeTruthy();
    expect((await zona.json()) as { sector: string }).toMatchObject({
      sector: "Centro - Calle 30",
    });

    const listado = await request.get(
      `${API_URL}/gestor/espacios?busqueda=Espacio%20m%C3%B3vil%20Calle%2030%20-%20A`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(listado.ok()).toBeTruthy();
    const cuerpo = (await listado.json()) as { datos: Array<{ id: string }> };
    const espacio = cuerpo.datos.find(Boolean);
    if (!espacio) throw new Error("No se encontró el espacio del seed.");

    const respuesta = await request.post(
      `${API_URL}/gestor/espacios/${espacio.id}/bloqueos`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { fechaInicio: "2026-11-10", fechaFin: "2026-11-12" },
      },
    );

    expect(respuesta.status()).toBe(409);
    const error = (await respuesta.json()) as { message: string };
    expect(error.message).toContain("PER-2026-00001");
  });
});
