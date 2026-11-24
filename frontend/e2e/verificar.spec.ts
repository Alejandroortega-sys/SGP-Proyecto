import { expect, test, type APIRequestContext } from "@playwright/test";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  iniciarSesionApi,
  radicarSolicitudApi,
  resolverSolicitudApi,
  tomarRevisionApi,
} from "./helpers";
import { eliminarSolicitudesConPermisosPrueba } from "./limpieza-permisos";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
);
const PREFIJO = "E2E VERIFICAR";
const TOKEN_INEXISTENTE = "e".repeat(48);

function fechaFutura(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Emite un permiso de prueba vía API (flujo HU-16→20→31) y devuelve el
 * token QR para la verificación pública.
 */
async function emitirPermisoPrueba(
  request: APIRequestContext,
): Promise<{ permisoId: string; qrToken: string; numero: string }> {
  const tokenMaria = await iniciarSesionApi(
    request,
    CREDENCIALES.comerciante.correo,
    CREDENCIALES.comerciante.password,
  );
  const creada = await radicarSolicitudApi(
    request,
    tokenMaria,
    {
      // Espacio 2 (Venta de alimentos y frutas, requisitos 1-2-4): esta
      // suite corre al final (orden alfabético), después de la de
      // resolución, y su rango actual no cruza con el +300 de esa suite.
      // La vigencia incluye HOY para que el permiso sea verificable (D3).
      espacioId: "2",
      actividad: `${PREFIJO} ${Date.now()}`,
      productoIds: ["1"],
      fechaInicio: fechaFutura(-1),
      fechaFin: fechaFutura(2),
      horaInicio: "09:00",
      horaFin: "12:00",
    },
    [
      { requisitoId: "1", nombreOriginal: "cedula.pdf", buffer: PDF },
      { requisitoId: "2", nombreOriginal: "rut.pdf", buffer: PDF },
      { requisitoId: "4", nombreOriginal: "concepto-sanitario.pdf", buffer: PDF },
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
  });
  expect(resolucion.ok()).toBeTruthy();

  const emision = await request.post(
    `${API_URL}/gestor/permisos`,
    { ...cabecerasApi(tokenGestor), data: { solicitudId: creada.id } },
  );
  expect(emision.ok()).toBeTruthy();
  const permiso = (await emision.json()) as {
    id: string;
    numero: string;
    qrToken: string;
  };
  return {
    permisoId: permiso.id,
    qrToken: permiso.qrToken,
    numero: permiso.numero,
  };
}

test.describe.configure({ mode: "serial" });

test.describe("Verificación pública de permisos por QR (HU-33)", () => {
  let permisoIdPrueba = "";
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

  test("HU-33-CA1: un QR válido y vigente muestra «Permiso válido» sin sesión", async ({
    page,
    request,
  }) => {
    const permiso = await emitirPermisoPrueba(request);
    permisoIdPrueba = permiso.permisoId;
    qrToken = permiso.qrToken;

    // Sin iniciar sesión: la página pública acepta el código a mano.
    await page.goto("/verificar");
    await page.getByLabel(/^Código del carné/).fill(qrToken);
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await page.waitForURL(`**/verificar/${qrToken}`);

    await expect(page.getByText("Permiso válido")).toBeVisible();
    await expect(page.getByText("María Gómez")).toBeVisible();
    await expect(page.getByText("Vigente").first()).toBeVisible();
    // Categoría y vigencia también son visibles.
    await expect(page.getByText(/Vigencia/)).toBeVisible();
  });

  test("HU-33-CA2: un permiso suspendido muestra «Permiso no vigente» con su estado", async ({
    request,
    page,
  }) => {
    // El gestor suspende con motivo (HU-35) y el QR público reacciona al instante.
    const tokenGestor = await iniciarSesionApi(
      request,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
    );

    const cambio = await request.patch(
      `${API_URL}/gestor/permisos/${permisoIdPrueba}/estado`,
      {
        ...cabecerasApi(tokenGestor),
        data: {
          estado: "suspendido",
          motivo: "Verificación de prueba e2e (suspensión temporal)",
        },
      },
    );
    expect(cambio.ok()).toBeTruthy();

    await page.goto(`/verificar/${qrToken}`);
    await expect(page.getByText("Permiso no vigente")).toBeVisible();
    await expect(page.getByText("Suspendido").first()).toBeVisible();
  });

  test("HU-33-CA3: un código inexistente o mal formado muestra «Permiso no encontrado»", async ({
    page,
  }) => {
    await page.goto(`/verificar/${TOKEN_INEXISTENTE}`);
    await expect(page.getByText("Permiso no encontrado")).toBeVisible();

    await page.goto("/verificar/token-invalido");
    await expect(page.getByText("Permiso no encontrado")).toBeVisible();

    // Desde el formulario manual también llega al 404 público.
    await page.goto("/verificar");
    await page.getByLabel(/^Código del carné/).fill("no-es-un-token");
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(page.getByText("Permiso no encontrado")).toBeVisible();
  });

  test("HU-33-CA4: la respuesta pública no expone datos personales sensibles", async ({
    page,
  }) => {
    // El permiso de la prueba sigue suspendido del caso anterior: se
    // aprovecha para verificar que también la respuesta «no vigente»
    // respeta los datos mínimos de AGENTS §9.5.
    await page.goto(`/verificar/${qrToken}`);
    // Espera a que la consulta termine antes de leer el cuerpo.
    await expect(page.getByText(/Permiso no vigente/)).toBeVisible();
    const cuerpo = await page.locator("body").textContent();
    expect(cuerpo).not.toContain("maria.gomez");
    expect(cuerpo).not.toContain("1032456789");
    expect(cuerpo).not.toContain("3214567890");
    // Los campos permitidos sí están: validez, titular, categoría y vigencia.
    expect(cuerpo).toContain("Permiso no vigente");
    expect(cuerpo).toContain("María Gómez");
  });
});
