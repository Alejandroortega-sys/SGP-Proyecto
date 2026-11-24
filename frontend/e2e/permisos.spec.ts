import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  campo,
  iniciarSesion,
  iniciarSesionApi,
  radicarSolicitudApi,
  resolverSolicitudApi,
  tomarRevisionApi,
} from "./helpers";
import { eliminarSolicitudesConPermisosPrueba } from "./limpieza-permisos";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
);
const PREFIJO = "E2E PERMISOS";

function fechaFutura(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Crea una solicitud, la pone en revisión y la aprueba (HU-16 a HU-20). */
async function crearSolicitudAprobada(
  request: APIRequestContext,
  desplazamiento: number,
): Promise<{ solicitudId: string; actividad: string }> {
  const tokenComerciante = await iniciarSesionApi(
    request,
    CREDENCIALES.comerciante.correo,
    CREDENCIALES.comerciante.password,
  );
  const actividad = `${PREFIJO} ${Date.now()}-${desplazamiento}`;
  // Espacio 4 (Kiosco, actividad «Ferias y emprendimientos») para no cruzar
  // con la suite de resolución (espacio 2). La vigencia incluye HOY: la
  // verificación pública (HU-33) exige que la fecha actual esté dentro del
  // rango (decisión D3), así que la solicitud arranca ayer.
  const creada = await radicarSolicitudApi(request, tokenComerciante, {
    espacioId: "4",
    actividad,
    productoIds: ["1"],
    fechaInicio: fechaFutura(desplazamiento),
    fechaFin: fechaFutura(desplazamiento + 3),
    horaInicio: "09:00",
    horaFin: "12:00",
  }, [
    // Requisitos globales de «Ferias y emprendimientos»; el 7 (Cámara de
    // comercio) es opcional.
    { requisitoId: "1", nombreOriginal: "cedula.pdf", buffer: PDF },
    { requisitoId: "2", nombreOriginal: "rut.pdf", buffer: PDF },
  ]);

  const tokenGestor = await iniciarSesionApi(
    request,
    CREDENCIALES.revisor.correo,
    CREDENCIALES.revisor.password,
  );
  const toma = await tomarRevisionApi(
    request,
    tokenGestor,
    creada.id,
  );
  expect(toma.ok()).toBeTruthy();
  const resolucion = await resolverSolicitudApi(request, tokenGestor, creada.id, {
    decision: "aprobar",
    dictamen: "Solicitud de prueba para la emisión del permiso (e2e).",
  });
  expect(resolucion.ok()).toBeTruthy();

  return { solicitudId: creada.id, actividad };
}

/** Token QR del permiso, consultado como gestor. */
async function obtenerQrToken(
  request: APIRequestContext,
  permisoId: string,
): Promise<string> {
  const tokenGestor = await iniciarSesionApi(
    request,
    CREDENCIALES.revisor.correo,
    CREDENCIALES.revisor.password,
  );
  const respuesta = await request.get(
    `${API_URL}/gestor/permisos/${permisoId}`,
    cabecerasApi(tokenGestor),
  );
  expect(respuesta.ok()).toBeTruthy();
  const cuerpo = (await respuesta.json()) as { qrToken: string };
  return cuerpo.qrToken;
}

/** Consulta pública del QR (HU-33) vía API. */
async function verificarPublico(
  request: APIRequestContext,
  qrToken: string,
): Promise<{ valido: boolean; estado: string }> {
  const respuesta = await request.get(`${API_URL}/verificaciones/${qrToken}`);
  expect(respuesta.ok()).toBeTruthy();
  return (await respuesta.json()) as { valido: boolean; estado: string };
}

test.describe.configure({ mode: "serial" });

test.describe("Permisos digitales con QR (HU-31, HU-32, HU-34, HU-35)", () => {
  let permisoId = "";
  let permisoNumero = "";
  let qrToken = "";

  test.afterAll(async () => {
    const ids = await eliminarSolicitudesConPermisosPrueba(
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

  test("HU-31: el gestor emite el permiso desde la solicitud aprobada en menos de 2 s", async ({
    page,
    request,
  }) => {
    // Vigencia desde ayer: el permiso queda vigente HOY para las
    // verificaciones públicas de las pruebas siguientes (D3).
    const { solicitudId } = await crearSolicitudAprobada(request, -1);

    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/solicitudes/${solicitudId}`);

    const inicio = Date.now();
    await page.getByRole("button", { name: "Emitir permiso" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Emitir permiso" })
      .click();
    const alerta = page.getByText(/emitido y carné disponible/);
    await expect(alerta).toBeVisible();
    expect(Date.now() - inicio).toBeLessThan(2000);

    const textoAlerta = await alerta.textContent();
    permisoNumero = /PER-\d{4}-\d+/.exec(textoAlerta ?? "")?.[0] ?? "";
    expect(permisoNumero).toMatch(/^PER-\d{4}-\d+$/);

    const href = await page
      .getByRole("link", { name: /Ver el permiso y su trazabilidad/ })
      .getAttribute("href");
    permisoId = href?.split("/").pop() ?? "";
    expect(permisoId).toMatch(/^\d+$/);
    qrToken = await obtenerQrToken(request, permisoId);
    expect(qrToken).toMatch(/^[0-9a-f]{48}$/);

    // HU-31-CA3: el comerciante recibe la notificación del carné disponible.
    const tokenMaria = await iniciarSesionApi(
      request,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
    );
    const notificaciones = await request.get(
      `${API_URL}/notificaciones?limite=20&leida=false`,
      cabecerasApi(tokenMaria),
    );
    const cuerpo = (await notificaciones.json()) as {
      datos: Array<{ asunto: string; cuerpo: string | null }>;
    };
    const delPermiso = cuerpo.datos.find(
      (fila) => fila.asunto === `Carné digital ${permisoNumero} disponible`,
    );
    expect(delPermiso).toBeDefined();
  });

  test("HU-37-CA1: el detalle del gestor muestra datos, cobro y trazabilidad", async ({
    page,
    request,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/permisos/${permisoId}`);

    await expect(page.getByRole("heading", { name: permisoNumero })).toBeVisible();
    await expect(page.getByText("Vigente").first()).toBeVisible();
    // Tarifa general «General» ($30.000) porque la actividad de prueba no
    // tiene tarifa específica (decisión D11).
    await expect(page.getByText(/30\.000/).first()).toBeVisible();
    await expect(page.getByText("Cobro del uso de suelo")).toBeVisible();
    await expect(page.getByText(/Emisión del permiso/)).toBeVisible();
    await expect(page.getByText(/verificación(es)? por QR/)).toBeVisible();
    // El token QR está visible para el gestor.
    await expect(page.getByText(qrToken)).toBeVisible();

    // El detalle vía API confirma el enlace con la solicitud.
    const tokenGestor = await iniciarSesionApi(
      request,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
    );
    const detalle = await request.get(
      `${API_URL}/gestor/permisos/${permisoId}`,
      cabecerasApi(tokenGestor),
    );
    const cuerpo = (await detalle.json()) as {
      cobro: { estado: string; valor: string } | null;
      renovaciones: unknown[];
    };
    expect(cuerpo.cobro?.estado).toBe("pendiente");
    expect(cuerpo.renovaciones).toHaveLength(0);
  });

  test("HU-35-CA1: suspender con motivo hace que el QR deje de ser válido de inmediato", async ({
    page,
    request,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/permisos/${permisoId}`);

    await page.getByRole("button", { name: "Suspender" }).click();
    await campo(page, "Motivo").fill("Inspección de prueba: horario excedido");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Suspender permiso" })
      .click();

    await expect(
      page.getByText(/suspendido y comerciante notificado/i),
    ).toBeVisible();

    // El QR refleja el cambio al instante, sin caché.
    const publica = await verificarPublico(request, qrToken);
    expect(publica.valido).toBe(false);
    expect(publica.estado).toBe("suspendido");
  });

  test("HU-35-CA2: levantar la suspensión devuelve el permiso a vigente con el mismo QR", async ({
    page,
    request,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/permisos/${permisoId}`);

    await page
      .getByRole("button", { name: "Levantar suspensión" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Reactivar permiso" })
      .click();

    await expect(
      page.getByText(/reactivado y comerciante notificado/i),
    ).toBeVisible();

    // El mismo token vuelve a ser válido.
    const publica = await verificarPublico(request, qrToken);
    expect(publica.valido).toBe(true);
    expect(publica.estado).toBe("vigente");
  });

  test("HU-32-CA1/CA2: el comerciante ve su carné con QR y lo descarga en PDF", async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );
    await page.goto("/comerciante/permisos");

    const fila = page.locator("li", { hasText: permisoNumero });
    await expect(fila).toBeVisible();
    await expect(fila.getByText("Vigente")).toBeVisible();

    // HU-34-CA1: el aviso de vencimiento aparece si el permiso del seed
    // vence pronto (su vigencia es 2026-11-01 a 2026-11-30).
    const venceElSeed = new Date("2026-11-30T00:00:00") >= new Date();
    if (venceElSeed) {
      await expect(page.getByText(/próxim[oa]s a vencer/i)).toBeVisible();
    }

    await fila.getByRole("link", { name: "Ver carné" }).click();
    await page.waitForURL(`/comerciante/permisos/${permisoId}`);

    // HU-32-CA1: QR legible a pantalla completa con estado visible.
    await expect(
      page.getByAltText(`Código QR de verificación del permiso ${permisoNumero}`),
    ).toBeVisible();
    await expect(page.getByText("Vigente").first()).toBeVisible();

    // HU-32-CA2: descarga del carné en PDF.
    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Descargar carné (PDF)" }).click(),
    ]);
    expect(descarga.suggestedFilename()).toBe(`carne-${permisoNumero}.pdf`);
  });

  test("HU-34-CA2: el comerciante radica la renovación con datos precargados", async ({
    page,
    request,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );
    await page.goto(`/comerciante/permisos/${permisoId}`);

    await page.getByRole("button", { name: "Renovar" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Radicar renovación" })
      .click();

    const alerta = page.getByText(/radicada\./i);
    await expect(alerta).toBeVisible();
    const texto = await alerta.textContent();
    const numeroRadicado = /SOL-\d{4}-\d+/.exec(texto ?? "")?.[0] ?? "";
    expect(numeroRadicado).toMatch(/^SOL-\d{4}-\d+$/);

    // La solicitud de renovación queda radicada y visible al comerciante.
    const tokenMaria = await iniciarSesionApi(
      request,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
    );
    const mias = await request.get(
      `${API_URL}/solicitudes/mias?limite=20`,
      cabecerasApi(tokenMaria),
    );
    const cuerpo = (await mias.json()) as {
      datos: Array<{ numeroRadicado: string; estado: string }>;
    };
    const renovacion = cuerpo.datos.find(
      (fila) => fila.numeroRadicado === numeroRadicado,
    );
    expect(renovacion?.estado).toBe("radicada");
  });

  test("HU-35: revocar deja el permiso en estado final", async ({ page, request }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/permisos/${permisoId}`);

    await page.getByRole("button", { name: "Revocar" }).click();
    await campo(page, "Motivo").fill("Incumplimiento reiterado (prueba e2e)");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Revocar permiso" })
      .click();

    await expect(
      page.getByText(/revocado y comerciante notificado/i),
    ).toBeVisible();
    // Estado final: sin acciones disponibles.
    await expect(
      page.getByText(/estado final y no admite cambios/i),
    ).toBeVisible();

    const publica = await verificarPublico(request, qrToken);
    expect(publica.valido).toBe(false);
    expect(publica.estado).toBe("revocado");
  });

  test("HU-35-CA3: la trazabilidad registra cada cambio con motivo, autor y fecha", async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/permisos/${permisoId}`);

    // Emisión, suspensión, reactivación y revocación en orden cronológico.
    await expect(page.getByText(/Emisión del permiso/)).toBeVisible();
    await expect(
      page.getByText("Motivo: Inspección de prueba: horario excedido"),
    ).toBeVisible();
    await expect(page.getByText(/Reactivado a vigente/)).toBeVisible();
    await expect(
      page.getByText("Motivo: Incumplimiento reiterado (prueba e2e)"),
    ).toBeVisible();
    // El actor de los cambios queda registrado.
    await expect(page.getByText(/Por Carlos Ramírez/).first()).toBeVisible();
  });
});
