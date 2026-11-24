import { expect, test, type APIRequestContext } from "@playwright/test";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
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
const PREFIJO = "E2E COBROS";

function fechaFutura(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

interface EscenarioCobro {
  solicitudId: string;
  permisoId: string;
  permisoNumero: string;
  cobroId: string;
  valor: string;
}

/** Crea una solicitud aprobada, emite el permiso vía API y devuelve el cobro. */
async function crearPermisoConCobro(
  request: APIRequestContext,
): Promise<EscenarioCobro> {
  const tokenMaria = await iniciarSesionApi(
    request,
    CREDENCIALES.comerciante.correo,
    CREDENCIALES.comerciante.password,
  );
  const creada = await radicarSolicitudApi(
    request,
    tokenMaria,
    {
      // Espacio 4 (Ferias y emprendimientos) con vigencia futura (+360):
      // el cobro no depende de la vigencia actual y así no se cruza con la
      // suite de permisos (mismo espacio, rango actual).
      espacioId: "4",
      actividad: `${PREFIJO} ${Date.now()}`,
      productoIds: ["1"],
      fechaInicio: fechaFutura(360),
      fechaFin: fechaFutura(363),
      horaInicio: "09:00",
      horaFin: "12:00",
    },
    [
      { requisitoId: "1", nombreOriginal: "cedula.pdf", buffer: PDF },
      { requisitoId: "2", nombreOriginal: "rut.pdf", buffer: PDF },
    ],
  );

  const tokenGestor = await iniciarSesionApi(
    request,
    CREDENCIALES.revisor.correo,
    CREDENCIALES.revisor.password,
  );
  const toma = await tomarRevisionApi(request, tokenGestor, creada.id);
  expect(toma.ok()).toBeTruthy();
  const resolucion = await resolverSolicitudApi(request, tokenGestor, creada.id, {
    decision: "aprobar",
    dictamen: "Solicitud de prueba para el cobro (e2e).",
  });
  expect(resolucion.ok()).toBeTruthy();

  // HU-31/D11: la emisión crea el cobro pendiente con la tarifa vigente.
  const emision = await request.post(
    `${API_URL}/gestor/permisos`,
    { ...cabecerasApi(tokenGestor), data: { solicitudId: creada.id } },
  );
  expect(emision.ok()).toBeTruthy();
  const permiso = (await emision.json()) as {
    id: string;
    numero: string;
    cobro: { id: string; valor: string; estado: string } | null;
  };
  expect(permiso.cobro).not.toBeNull();
  expect(permiso.cobro?.estado).toBe("pendiente");

  return {
    solicitudId: creada.id,
    permisoId: permiso.id,
    permisoNumero: permiso.numero,
    cobroId: permiso.cobro?.id ?? "",
    valor: permiso.cobro?.valor ?? "",
  };
}

test.describe.configure({ mode: "serial" });

test.describe("Pagos simulados del uso de suelo (HU-36)", () => {
  let escenario: EscenarioCobro | null = null;

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

  test("HU-36-CA1: el comerciante ve el valor a pagar y el estado Pendiente", async ({
    page,
    request,
  }) => {
    escenario = await crearPermisoConCobro(request);

    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );
    await page.goto("/comerciante/pagos");

    const fila = page.locator("li", { hasText: escenario.permisoNumero });
    await expect(fila).toBeVisible();
    // Valor NUMERIC como string, formateado en pesos.
    const valor = Number(escenario.valor);
    await expect(
      fila.getByText(valor.toLocaleString("es-CO", { minimumFractionDigits: 2 })),
    ).toBeVisible();
    await expect(fila.getByText("Pendiente")).toBeVisible();

    // Aviso permanente y visible de pago simulado (AGENTS §9.12).
    await expect(
      page.getByText("Pago simulado: no se realiza ninguna transacción real."),
    ).toBeVisible();
  });

  test("HU-36-CA2: confirmar el pago simulado pasa el cobro a Pagado y habilita el recibo", async ({
    page,
  }) => {
    const actual = escenario;
    if (!actual) throw new Error("El escenario del cobro no se creó en la prueba anterior.");

    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );
    await page.goto("/comerciante/pagos");

    const fila = page.locator("li", { hasText: actual.permisoNumero });
    await fila.getByRole("button", { name: "Pagar (simulado)" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmar pago simulado" })
      .click();

    await expect(
      page.getByText(/Pago simulado registrado/i),
    ).toBeVisible();
    await expect(fila.getByText("Pagado", { exact: true })).toBeVisible();

    // El recibo se descarga en PDF.
    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      fila.getByRole("button", { name: "Descargar recibo" }).click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^recibo-COB-\d+\.pdf$/);
  });

  test("HU-36-CA3: el gestor consulta el permiso y ve el cobro pagado", async ({
    request,
  }) => {
    const actual = escenario;
    if (!actual) throw new Error("El escenario del cobro no se creó en la prueba anterior.");

    const tokenGestor = await iniciarSesionApi(
      request,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
    );
    const detalle = await request.get(
      `${API_URL}/gestor/permisos/${actual.permisoId}`,
      cabecerasApi(tokenGestor),
    );
    expect(detalle.ok()).toBeTruthy();
    const cuerpo = (await detalle.json()) as {
      cobro: { estado: string; pagadoEn: string | null } | null;
    };
    expect(cuerpo.cobro?.estado).toBe("pagado");
    expect(cuerpo.cobro?.pagadoEn).not.toBeNull();
  });
});
