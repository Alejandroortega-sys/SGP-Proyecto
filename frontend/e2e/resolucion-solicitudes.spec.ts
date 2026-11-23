import { expect, test, type APIRequestContext } from "@playwright/test";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  iniciarSesion,
  iniciarSesionApi,
  obtenerMiSolicitudApi,
  obtenerNotificaciones,
  obtenerSolicitudRevisionApi,
  radicarSolicitudApi,
  resolverSolicitudApi,
  tomarRevisionApi,
} from "./helpers";
import { eliminarSolicitudesPrueba } from "./limpieza-solicitudes";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
);
const PREFIJO = "E2E RESOLUCION";

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
  correo: string,
  desplazamiento: number,
): Promise<SolicitudCreada> {
  const tokenComerciante = await iniciarSesionApi(
    request,
    correo,
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

async function verificarNoCumpleApi(
  request: APIRequestContext,
  token: string,
  solicitudId: string,
  requisitoId: string,
  observacion: string,
) {
  return request.patch(
    `${API_URL}/gestor/solicitudes/${solicitudId}/requisitos/${requisitoId}/verificacion`,
    {
      ...cabecerasApi(token),
      data: { estado: "no_cumple", observacion },
    },
  );
}

test.describe.configure({ mode: "serial" });

test.describe("Resolución de solicitudes del gestor (HU-20)", () => {
  test.afterAll(async () => {
    for (const correo of [
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante2.correo,
    ]) {
      const ids = await eliminarSolicitudesPrueba(correo, PREFIJO);
      for (const id of ids) {
        await rm(
          resolve(process.cwd(), "..", "uploads-privados", "solicitudes", id),
          { recursive: true, force: true },
        );
      }
    }
  });

  test("aprueba, asigna el espacio y muestra el dictamen al comerciante", async ({
    page,
    request,
  }) => {
    const solicitud = await crearSolicitud(
      request,
      CREDENCIALES.comerciante.correo,
      300,
    );

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/solicitudes/${solicitud.id}`);
    await expect(page.getByText(/Tienes el bloqueo de revisión/)).toBeVisible();

    await page
      .getByRole("button", { name: "Aprobar y asignar espacio" })
      .click();
    const dialogo = page.getByRole("dialog");
    await expect(
      dialogo.getByRole("heading", { name: "Aprobar y asignar espacio" }),
    ).toBeVisible();
    await dialogo
      .getByLabel("Dictamen (opcional)")
      .fill("Cumple con los requisitos documentales.");
    await dialogo
      .getByRole("button", { name: "Aprobar y asignar espacio" })
      .click();

    await expect(
      page
        .getByText("Solicitud aprobada y espacio asignado.")
        .first(),
    ).toBeVisible();
    await expect(page.getByText("Aprobada").first()).toBeVisible();

    const tokenComerciante = await iniciarSesionApi(
      request,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
    );
    const detalle = await obtenerMiSolicitudApi(
      request,
      tokenComerciante,
      solicitud.id,
    );
    expect(detalle.ok()).toBeTruthy();
    const cuerpo = (await detalle.json()) as {
      estado: string;
      dictamen: string | null;
      asignacion: { espacioId: string; fechaInicio: string } | null;
    };
    expect(cuerpo.estado).toBe("aprobada");
    expect(cuerpo.dictamen).toBe("Cumple con los requisitos documentales.");
    expect(cuerpo.asignacion?.espacioId).toBe("2");
    expect(cuerpo.asignacion?.fechaInicio).toBe(fechaFutura(300));

    const notificaciones = await obtenerNotificaciones(
      request,
      tokenComerciante,
    );
    expect(
      notificaciones.some(
        (notificacion) =>
          notificacion.solicitudId === solicitud.id &&
          notificacion.asunto.toLowerCase().includes("aprobada"),
      ),
    ).toBe(true);
  });

  test("rechaza con motivo obligatorio y lo muestra al comerciante", async ({
    page,
    request,
  }) => {
    const solicitud = await crearSolicitud(
      request,
      CREDENCIALES.comerciante.correo,
      310,
    );

    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/solicitudes/${solicitud.id}`);
    await expect(page.getByText(/Tienes el bloqueo de revisión/)).toBeVisible();

    await page.getByRole("button", { name: "Rechazar solicitud" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(
      dialogo.getByRole("heading", { name: "Rechazar solicitud" }),
    ).toBeVisible();

    await dialogo
      .getByRole("button", { name: "Rechazar solicitud" })
      .click();
    await expect(
      dialogo.getByText(/Escribe el motivo del rechazo/),
    ).toBeVisible();

    const motivo = "La documentación no permite verificar la actividad.";
    await dialogo.getByLabel(/^Motivo del rechazo/).fill(motivo);
    await dialogo
      .getByRole("button", { name: "Rechazar solicitud" })
      .click();

    await expect(
      page.getByText("Solicitud rechazada. El motivo quedó registrado."),
    ).toBeVisible();
    await expect(page.getByText("Rechazada").first()).toBeVisible();

    const tokenComerciante = await iniciarSesionApi(
      request,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
    );
    const detalle = await obtenerMiSolicitudApi(
      request,
      tokenComerciante,
      solicitud.id,
    );
    expect(detalle.ok()).toBeTruthy();
    const cuerpo = (await detalle.json()) as {
      estado: string;
      motivoRechazo: string | null;
      asignacion: unknown;
    };
    expect(cuerpo.estado).toBe("rechazada");
    expect(cuerpo.motivoRechazo).toBe(motivo);
    expect(cuerpo.asignacion).toBeNull();
  });

  test("bloquea la aprobación cuando hay requisitos No cumple", async ({
    page,
    request,
  }) => {
    const solicitud = await crearSolicitud(
      request,
      CREDENCIALES.comerciante.correo,
      320,
    );
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

    const verificacion = await verificarNoCumpleApi(
      request,
      tokenAdmin,
      solicitud.id,
      "1",
      "Documento ilegible.",
    );
    expect(verificacion.ok()).toBeTruthy();

    await page.reload();
    await expect(
      page.getByText(/No se puede aprobar: hay requisitos/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Aprobar y asignar espacio" }),
    ).toBeDisabled();

    const intento = await resolverSolicitudApi(
      request,
      tokenAdmin,
      solicitud.id,
      { decision: "aprobar" },
    );
    expect(intento.status()).toBe(409);
  });

  test("impide la doble asignación con dos aprobaciones concurrentes", async ({
    request,
  }) => {
    const primera = await crearSolicitud(
      request,
      CREDENCIALES.comerciante.correo,
      500,
    );
    const segunda = await crearSolicitud(
      request,
      CREDENCIALES.comerciante2.correo,
      500,
    );
    const tokenAdmin = await iniciarSesionApi(
      request,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
    );
    const tokenRevisor = await iniciarSesionApi(
      request,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
    );

    const tomaA = await tomarRevisionApi(request, tokenAdmin, primera.id);
    const tomaB = await tomarRevisionApi(request, tokenRevisor, segunda.id);
    expect(tomaA.ok()).toBeTruthy();
    expect(tomaB.ok()).toBeTruthy();

    const [resultadoA, resultadoB] = await Promise.all([
      resolverSolicitudApi(request, tokenAdmin, primera.id, {
        decision: "aprobar",
      }),
      resolverSolicitudApi(request, tokenRevisor, segunda.id, {
        decision: "aprobar",
      }),
    ]);
    const estados = [resultadoA.status(), resultadoB.status()].sort(
      (a, b) => a - b,
    );
    expect(estados).toEqual([200, 409]);

    const detalleA = await obtenerSolicitudRevisionApi(
      request,
      tokenAdmin,
      primera.id,
    );
    const detalleB = await obtenerSolicitudRevisionApi(
      request,
      tokenAdmin,
      segunda.id,
    );
    const aprobadas = [await detalleA.json(), await detalleB.json()].filter(
      (detalle: { estado: string }) => detalle.estado === "aprobada",
    );
    expect(aprobadas).toHaveLength(1);
  });

  test("impide resolver dos veces la misma solicitud de forma concurrente", async ({
    request,
  }) => {
    const solicitud = await crearSolicitud(
      request,
      CREDENCIALES.comerciante.correo,
      600,
    );
    const tokenAdmin = await iniciarSesionApi(
      request,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
    );

    const toma = await tomarRevisionApi(request, tokenAdmin, solicitud.id);
    expect(toma.ok()).toBeTruthy();

    const [primera, segunda] = await Promise.all([
      resolverSolicitudApi(request, tokenAdmin, solicitud.id, {
        decision: "aprobar",
      }),
      resolverSolicitudApi(request, tokenAdmin, solicitud.id, {
        decision: "aprobar",
      }),
    ]);
    const estados = [primera.status(), segunda.status()].sort((a, b) => a - b);
    expect(estados).toEqual([200, 409]);
  });

  test("la pantalla de resolución es usable en móvil", async ({ page, request }) => {
    const solicitud = await crearSolicitud(
      request,
      CREDENCIALES.comerciante.correo,
      330,
    );

    await page.setViewportSize({ width: 360, height: 900 });
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/solicitudes/${solicitud.id}`);
    await expect(
      page.getByRole("button", { name: "Aprobar y asignar espacio" }),
    ).toBeVisible();

    const desbordamiento = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(desbordamiento).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Rechazar solicitud" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const desbordamientoDialogo = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(desbordamientoDialogo).toBeLessThanOrEqual(1);
  });
});
