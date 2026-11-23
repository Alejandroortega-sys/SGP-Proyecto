import { expect, test } from "@playwright/test";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  crearFeriaApi,
  iniciarSesion,
  iniciarSesionApi,
  obtenerEspaciosApi,
  obtenerNotificaciones,
  obtenerOpcionesFeriaApi,
  tokenSesion,
} from "./helpers";
import { eliminarFeriasPrueba } from "./limpieza-ferias";

const PREFIJO = "E2E Calendario";
const NOMBRE = `${PREFIJO} Centro`;
const FECHA_INICIO = "2026-12-15";
const FECHA_FIN = "2026-12-17";

test.describe("Calendario de ferias del gestor", () => {
  test.beforeAll(async () => {
    await eliminarFeriasPrueba(CREDENCIALES.organizador.correo, PREFIJO);
  });

  test.afterAll(async () => {
    await eliminarFeriasPrueba(CREDENCIALES.organizador.correo, PREFIJO);
  });

  test("aprueba, mueve y cancela una feria liberando los espacios", async ({
    page,
    request,
  }) => {
    const tokenOrganizador = await iniciarSesionApi(
      request,
      CREDENCIALES.organizador.correo,
      CREDENCIALES.organizador.password,
    );
    const tokenComerciante = await iniciarSesionApi(
      request,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
    );
    const opciones = await obtenerOpcionesFeriaApi(
      request,
      tokenOrganizador,
    );
    const zona = opciones.zonas.find(
      (item) => item.nombre === "Centro - Calle 30",
    );
    if (!zona) throw new Error("No se encontró la zona Centro - Calle 30");
    const producto = opciones.productos.find((item) =>
      zona.productosPermitidos.includes(item.nombre),
    );
    if (!producto) throw new Error("La zona no tiene productos disponibles");

    const feria = await crearFeriaApi(request, tokenOrganizador, {
      nombre: NOMBRE,
      tipoFeria: "Feria agroecológica",
      zonaId: zona.id,
      fechaInicio: FECHA_INICIO,
      fechaFin: FECHA_FIN,
      numeroPuestos: 10,
      productoIds: [producto.id],
    });

    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/ferias");
    await expect(
      page.getByRole("heading", { name: "Calendario de ferias y eventos" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Periodo siguiente" }).click();
    await expect(page.getByText("Diciembre 2026")).toBeVisible();

    await abrirEvento(page);
    await page.getByRole("button", { name: "Aprobar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Aprobar feria" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Aprobar y bloquear espacios" })
      .click();
    await expect(
      page.getByText("Feria aprobada y espacios bloqueados."),
    ).toBeVisible();

    const notificaciones = await obtenerNotificaciones(
      request,
      tokenOrganizador,
    );
    expect(
      notificaciones.some(
        (notificacion) =>
          notificacion.feriaId === feria.id &&
          notificacion.asunto.includes("aprobada"),
      ),
    ).toBe(true);

    const espaciosBloqueados = await obtenerEspaciosApi(
      request,
      tokenComerciante,
      FECHA_INICIO,
    );
    const espaciosCentro = espaciosBloqueados.filter(
      (espacio) => espacio.zona?.nombre === "Centro - Calle 30",
    );
    expect(espaciosCentro.length).toBeGreaterThan(0);
    expect(
      espaciosCentro.some(
        (espacio) =>
          !espacio.disponible &&
          (espacio.motivoEstado ?? "").includes(feria.numeroRadicado),
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "Semana" }).click();
    await expect(page.getByText("Semana del")).toBeVisible();
    await page.getByRole("button", { name: "Periodo siguiente" }).click();
    await page.getByRole("button", { name: "Periodo siguiente" }).click();
    await expect(page.getByTestId(`zona-semana-${zona.id}`)).toBeVisible();
    await expect(page.getByText(NOMBRE).first()).toBeVisible();

    await page.getByRole("button", { name: "Mes" }).click();
    await expect(page.getByText("Diciembre 2026")).toBeVisible();

    await abrirEvento(page);
    await page.getByRole("button", { name: "Mover", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Mover feria" }),
    ).toBeVisible();
    await page.getByLabel(/^Fecha de inicio/).fill("2027-01-15");
    await page.getByLabel(/^Fecha de fin/).fill("2027-01-17");
    await expect(
      page.getByText("No se puede aplicar el cambio por estos cruces:"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Guardar cambio" }),
    ).toBeDisabled();

    await page.getByLabel(/^Fecha de inicio/).fill("2026-12-20");
    await page.getByLabel(/^Fecha de fin/).fill("2026-12-22");
    await expect(
      page.getByText("La zona está libre para las fechas indicadas."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Guardar cambio" }).click();
    await expect(page.getByText("Feria movida correctamente.")).toBeVisible();

    await abrirEvento(page);
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Cancelar feria" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancelar feria" }).click();
    await expect(
      page.getByText("Debes escribir el motivo de la cancelación."),
    ).toBeVisible();
    await page
      .getByLabel(/^Motivo de la cancelación/)
      .fill("La zona se requiere para una jornada institucional.");
    await page.getByRole("button", { name: "Cancelar feria" }).click();
    await expect(
      page.getByText("Feria cancelada y espacios liberados."),
    ).toBeVisible();

    const tokenGestor = await tokenSesion(page);
    const detalle = await request.get(`${API_URL}/gestor/ferias/${feria.id}`, {
      ...cabecerasApi(tokenGestor),
    });
    expect(detalle.ok()).toBeTruthy();
    const cuerpoDetalle = (await detalle.json()) as {
      estado: string;
      motivoCancelacion: string | null;
      fechaInicio: string;
      fechaFin: string;
    };
    expect(cuerpoDetalle.estado).toBe("cancelada");
    expect(cuerpoDetalle.motivoCancelacion).toContain("jornada");
    expect(cuerpoDetalle.fechaInicio).toBe("2026-12-20");
    expect(cuerpoDetalle.fechaFin).toBe("2026-12-22");

    const espaciosLiberados = await obtenerEspaciosApi(
      request,
      tokenComerciante,
      "2026-12-20",
    );
    const centroLibre = espaciosLiberados.filter(
      (espacio) => espacio.zona?.nombre === "Centro - Calle 30",
    );
    expect(centroLibre.some((espacio) => espacio.disponible)).toBe(true);
    expect(
      centroLibre.some((espacio) =>
        (espacio.motivoEstado ?? "").includes(feria.numeroRadicado),
      ),
    ).toBe(false);
  });

  test("se adapta a 360 px sin desplazamiento horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/ferias");
    await expect(
      page.getByRole("heading", { name: "Calendario de ferias y eventos" }),
    ).toBeVisible();
    const ancho = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(ancho).toBeLessThanOrEqual(361);
  });
});

async function abrirEvento(page: Parameters<typeof iniciarSesion>[0]) {
  await page
    .getByRole("button", { name: new RegExp(`^${NOMBRE}`) })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: NOMBRE })).toBeVisible();
}
