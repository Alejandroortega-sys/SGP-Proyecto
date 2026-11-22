import { expect, test, type APIRequestContext } from "@playwright/test";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  iniciarSesion,
  iniciarSesionApi,
  obtenerNotificaciones,
  radicarSolicitudApi,
} from "./helpers";
import {
  eliminarSolicitudesPrueba,
  expirarBloqueoRevision,
} from "./limpieza-solicitudes";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
);
const PREFIJO = "E2E REVISION";
const BASE_URL = "http://localhost:3001";

function fechaFutura(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

interface SolicitudCreada {
  id: string;
  numeroRadicado: string;
  actividad: string;
  tokenComerciante: string;
}

async function crearSolicitud(
  request: APIRequestContext,
  desplazamiento: number,
): Promise<SolicitudCreada> {
  const tokenComerciante = await iniciarSesionApi(
    request,
    CREDENCIALES.comerciante.correo,
    CREDENCIALES.comerciante.password,
  );
  const actividad = `${PREFIJO} ${Date.now()}-${desplazamiento}`;
  const creada = await radicarSolicitudApi(
    request,
    tokenComerciante,
    {
      espacioId: "2",
      actividad,
      productoIds: ["1"],
      fechaInicio: fechaFutura(desplazamiento),
      fechaFin: fechaFutura(desplazamiento + 2),
      horaInicio: "09:00",
      horaFin: "12:00",
    },
    [
      {
        requisitoId: "1",
        nombreOriginal: "cedula.pdf",
        buffer: PDF,
      },
      {
        requisitoId: "2",
        nombreOriginal: "rut.pdf",
        buffer: PDF,
      },
      {
        requisitoId: "4",
        nombreOriginal: "concepto-sanitario.pdf",
        buffer: PDF,
      },
    ],
  );

  return {
    id: creada.id,
    numeroRadicado: creada.numeroRadicado,
    actividad,
    tokenComerciante,
  };
}

async function obtenerRevisionApi(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<{
  estado: string;
  bloqueo: { esPropio: boolean; gestor: { nombre: string } } | null;
  historial: Array<{ estadoNuevo: string }>;
}> {
  const respuesta = await request.get(
    `${API_URL}/gestor/solicitudes/${id}`,
    cabecerasApi(token),
  );
  expect(respuesta.ok()).toBeTruthy();
  return (await respuesta.json()) as {
    estado: string;
    bloqueo: { esPropio: boolean; gestor: { nombre: string } } | null;
    historial: Array<{ estadoNuevo: string }>;
  };
}

async function verificarApi(
  request: APIRequestContext,
  token: string,
  solicitudId: string,
  requisitoId: string,
  datos: { estado: "cumple" | "no_cumple"; observacion?: string },
) {
  return request.patch(
    `${API_URL}/gestor/solicitudes/${solicitudId}/requisitos/${requisitoId}/verificacion`,
    {
      ...cabecerasApi(token),
      data: datos,
    },
  );
}

test.describe.configure({ mode: "serial" });

test.describe("Revisión documental del gestor (HU-19)", () => {
  test.afterAll(async () => {
    const ids = await eliminarSolicitudesPrueba(
      CREDENCIALES.comerciante.correo,
      PREFIJO,
    );
    for (const id of ids) {
      await rm(
        resolve(process.cwd(), "..", "uploads-privados", "solicitudes", id),
        { recursive: true, force: true },
      );
    }
  });

  test("bandeja con filtros, orden y vista móvil", async ({ page, request }) => {
    const solicitud = await crearSolicitud(request, 200);

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/solicitudes");
    await expect(
      page.getByRole("heading", { name: "Revisión de solicitudes" }),
    ).toBeVisible();

    const primeroAntiguo = await page
      .locator("tbody tr")
      .first()
      .locator("td")
      .first()
      .innerText();
    await page.getByLabel("Orden").selectOption("reciente");
    await page.getByRole("button", { name: "Filtrar" }).click();
    const primeroReciente = await page
      .locator("tbody tr")
      .first()
      .locator("td")
      .first()
      .innerText();
    expect(primeroReciente).not.toBe(primeroAntiguo);

    await page.getByLabel("Orden").selectOption("antiguedad");
    await page.getByLabel("Estado").selectOption("radicada");
    await page.getByLabel("Sector").selectOption("Centro");
    await page
      .getByLabel("Tipo de actividad")
      .selectOption("Venta de alimentos y frutas");
    await page.getByRole("button", { name: "Filtrar" }).click();

    await expect(
      page.getByText(solicitud.numeroRadicado).first(),
    ).toBeVisible();
    await expect(page.getByText(solicitud.actividad).first()).toBeVisible();

    await page.setViewportSize({ width: 360, height: 900 });
    await page.reload();
    await expect(
      page.locator("li").getByText(solicitud.numeroRadicado),
    ).toBeVisible();
    const desbordamiento = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(desbordamiento).toBeLessThanOrEqual(1);
  });

  test("revisa documentos, guarda Cumple y No cumple, y persiste el avance", async ({
    page,
    request,
  }) => {
    const solicitud = await crearSolicitud(request, 210);
    const tokenAdmin = await iniciarSesionApi(
      request,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
    );

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/solicitudes/${solicitud.id}`);
    await expect(page.getByText(/Tienes el bloqueo de revisión/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Lista de verificación" }),
    ).toBeVisible();
    await expect(page.getByTitle(/Vista previa de/)).toBeVisible({
      timeout: 20_000,
    });

    const tarjetaRut = page.locator("article").filter({ hasText: "RUT" }).first();
    await tarjetaRut.getByRole("button", { name: "Cumple", exact: true }).click();
    await tarjetaRut
      .getByRole("button", { name: "Guardar verificación" })
      .click();
    await expect(
      page.getByText("Requisito marcado como «Cumple»."),
    ).toBeVisible();

    const tarjetaIdentidad = page
      .locator("article")
      .filter({ hasText: "Documento de identidad" })
      .first();
    await tarjetaIdentidad
      .getByRole("button", { name: "No cumple", exact: true })
      .click();
    await tarjetaIdentidad
      .getByRole("button", { name: "Guardar verificación" })
      .click();
    await expect(
      tarjetaIdentidad.getByText(/debes escribir una observación/),
    ).toBeVisible();

    await tarjetaIdentidad
      .getByLabel("Observación para el comerciante")
      .fill("La cédula no es legible.");
    await tarjetaIdentidad
      .getByRole("button", { name: "Guardar verificación" })
      .click();
    await expect(
      page.getByText("Requisito marcado como «No cumple»."),
    ).toBeVisible();

    const revisionApi = await obtenerRevisionApi(
      request,
      tokenAdmin,
      solicitud.id,
    );
    expect(revisionApi.estado).toBe("en_revision");

    await page.reload();
    await expect(page.getByText(/Tienes el bloqueo de revisión/)).toBeVisible();
    await expect(
      page.getByText(/2 de 4 requisitos verificados/),
    ).toBeVisible();
    await expect(
      tarjetaIdentidad.locator("span").filter({ hasText: /^No cumple$/ }),
    ).toBeVisible();
    await expect(
      tarjetaRut.locator("span").filter({ hasText: /^Cumple$/ }),
    ).toBeVisible();
  });

  test("devuelve para corrección, notifica y muestra el No cumple al comerciante", async ({
    browser,
    page,
    request,
  }) => {
    const solicitud = await crearSolicitud(request, 220);
    const tokenAdmin = await iniciarSesionApi(
      request,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
    );

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/solicitudes/${solicitud.id}`);
    await expect(page.getByText(/Tienes el bloqueo de revisión/)).toBeVisible();

    const tarjetaIdentidad = page
      .locator("article")
      .filter({ hasText: "Documento de identidad" })
      .first();
    await tarjetaIdentidad
      .getByRole("button", { name: "No cumple", exact: true })
      .click();
    await tarjetaIdentidad
      .getByLabel("Observación para el comerciante")
      .fill("La cédula está vencida.");
    await tarjetaIdentidad
      .getByRole("button", { name: "Guardar verificación" })
      .click();

    await page
      .getByRole("button", { name: "Devolver para corrección" })
      .click();
    await page
      .getByLabel("Observación general")
      .fill("Corrige la cédula y vuelve a radicar la solicitud.");
    await page.getByRole("button", { name: "Devolver solicitud" }).click();

    await expect(
      page.getByText(/La solicitud cambió a «Requiere corrección»|Solicitud actualizada a «Requiere corrección»|devolvió la solicitud/i),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Requiere corrección", { exact: true }).first()).toBeVisible();

    const revisionApi = await obtenerRevisionApi(
      request,
      tokenAdmin,
      solicitud.id,
    );
    expect(revisionApi.estado).toBe("devuelta");
    expect(revisionApi.bloqueo).toBeNull();
    expect(
      revisionApi.historial.some((registro) => registro.estadoNuevo === "devuelta"),
    ).toBe(true);

    const notificaciones = await obtenerNotificaciones(
      request,
      solicitud.tokenComerciante,
    );
    expect(
      notificaciones.some(
        (notificacion) =>
          notificacion.solicitudId === solicitud.id &&
          notificacion.cuerpo?.includes("Corrige la cédula"),
      ),
    ).toBe(true);

    const contextoComerciante = await browser.newContext({ baseURL: BASE_URL });
    const paginaComerciante = await contextoComerciante.newPage();
    await iniciarSesion(
      paginaComerciante,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );
    await paginaComerciante.goto(
      `/comerciante/solicitudes/${solicitud.id}`,
    );
    await expect(
      paginaComerciante.getByText("No cumple", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      paginaComerciante.getByText("La cédula está vencida."),
    ).toBeVisible();
    await contextoComerciante.close();
  });

  test("concurrencia: el segundo gestor ve solo lectura y no puede verificar", async ({
    browser,
    page,
    request,
  }) => {
    const solicitud = await crearSolicitud(request, 230);
    const tokenRevisor = await iniciarSesionApi(
      request,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
    );

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/solicitudes/${solicitud.id}`);
    await expect(page.getByText(/Tienes el bloqueo de revisión/)).toBeVisible();

    const contextoRevisor = await browser.newContext({ baseURL: BASE_URL });
    const paginaRevisor = await contextoRevisor.newPage();
    await iniciarSesion(
      paginaRevisor,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await paginaRevisor.goto(`/gestor/solicitudes/${solicitud.id}`);
    await expect(
      paginaRevisor.getByText(/Laura Martínez está revisando esta solicitud/),
    ).toBeVisible();
    await expect(
      paginaRevisor.getByRole("button", { name: "Guardar verificación" }),
    ).toHaveCount(0);

    const intento = await verificarApi(
      request,
      tokenRevisor,
      solicitud.id,
      "1",
      { estado: "cumple" },
    );
    expect(intento.status()).toBe(409);

    await page.goto("/gestor/solicitudes");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await paginaRevisor.reload();
    await expect(
      paginaRevisor.getByText(/Tienes el bloqueo de revisión/),
    ).toBeVisible({ timeout: 20_000 });
    await contextoRevisor.close();
  });

  test("expiración: otro gestor toma la revisión y el bloqueo anterior deja de editar", async ({
    browser,
    page,
    request,
  }) => {
    const solicitud = await crearSolicitud(request, 240);
    const tokenAdmin = await iniciarSesionApi(
      request,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
    );

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/solicitudes/${solicitud.id}`);
    await expect(page.getByText(/Tienes el bloqueo de revisión/)).toBeVisible();

    await expirarBloqueoRevision(solicitud.id);

    const contextoRevisor = await browser.newContext({ baseURL: BASE_URL });
    const paginaRevisor = await contextoRevisor.newPage();
    await iniciarSesion(
      paginaRevisor,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await paginaRevisor.goto(`/gestor/solicitudes/${solicitud.id}`);
    await expect(
      paginaRevisor.getByText(/Tienes el bloqueo de revisión/),
    ).toBeVisible({ timeout: 20_000 });

    const intento = await verificarApi(
      request,
      tokenAdmin,
      solicitud.id,
      "1",
      { estado: "cumple" },
    );
    expect(intento.status()).toBe(409);

    await contextoRevisor.close();
  });
});
