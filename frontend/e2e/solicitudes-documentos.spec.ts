import { expect, test } from "@playwright/test";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  campo,
  iniciarSesion,
  tokenSesion,
} from "./helpers";
import { eliminarSolicitudesPrueba } from "./limpieza-solicitudes";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
);
const PREFIJO = "E2E DOCS";

function fechaFutura(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const FECHA_INICIO = fechaFutura(60);
const FECHA_FIN = fechaFutura(62);

test.describe.configure({ mode: "serial" });

test.describe("Documentos de la solicitud (HU-17)", () => {
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

  test("carga, valida y reemplaza documentos con vista previa y versiones", async ({
    page,
    request,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );

    const actividad = `${PREFIJO} ${Date.now()}`;

    await page.goto("/comerciante/solicitudes/nueva");
    await page
      .getByRole("button", { name: "Seleccionar Kiosco Parque La Guadua" })
      .click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await campo(page, "Actividad").fill(actividad);
    await page.getByRole("checkbox", { name: "Artesanías" }).check();
    await page.getByRole("button", { name: "Continuar" }).click();

    await page.getByLabel("Adjuntar Documento de identidad").setInputFiles({
      name: "cedula.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    await page.getByLabel("Adjuntar RUT").setInputFiles({
      name: "rut.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    await page.getByRole("button", { name: "Continuar" }).click();

    await campo(page, "Fecha de inicio").fill(FECHA_INICIO);
    await campo(page, "Fecha de fin").fill(FECHA_FIN);
    await campo(page, "Hora de inicio").fill("09:00");
    await campo(page, "Hora de fin").fill("12:00");
    await expect(
      page.getByText(
        "El espacio está disponible para las fechas y el horario indicados.",
      ),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Radicar solicitud" }).click();
    await page.waitForURL("**/confirmacion**", { timeout: 30_000 });

    const token = await tokenSesion(page);
    const respuesta = await request.get(
      `${API_URL}/solicitudes/mias?limite=20`,
      cabecerasApi(token),
    );
    expect(respuesta.ok()).toBeTruthy();
    const cuerpo = (await respuesta.json()) as {
      datos: Array<{ id: string; actividad: string }>;
    };
    const solicitud = cuerpo.datos.find((item) => item.actividad === actividad);
    expect(solicitud).toBeTruthy();

    await page.goto(`/comerciante/solicitudes/${solicitud?.id}`);
    await expect(
      page.getByRole("heading", { name: "Documentos", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Documento de identidad").first()).toBeVisible();
    await expect(page.getByText("Cargado", { exact: true })).toHaveCount(2);

    // Vista previa del documento ya radicado.
    await page
      .getByRole("button", {
        name: "Vista previa de Documento de identidad",
      })
      .click();
    await expect(
      page.getByTitle("Vista previa de cedula.pdf"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cerrar", exact: true }).last().click();

    // Un formato no permitido se rechaza en el cliente y no inicia la carga.
    await page
      .getByRole("button", { name: "Reemplazar Documento de identidad" })
      .click();
    await page.getByLabel("Adjuntar Documento de identidad").setInputFiles({
      name: "documento.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("texto"),
    });
    await expect(page.getByText("El documento debe ser PDF, JPG o PNG.")).toBeVisible();

    // La carga válida muestra la barra de progreso mientras el servidor responde.
    await page.route("**/solicitudes/*/documentos", async (ruta) => {
      await new Promise((resolver) => setTimeout(resolver, 1_200));
      await ruta.continue();
    });

    await page.getByLabel("Adjuntar Documento de identidad").setInputFiles({
      name: "cedula-corregida.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    await expect(
      page.getByRole("button", { name: "Ver vista previa" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Subir reemplazo" }).click();
    await expect(
      page.getByRole("progressbar", {
        name: "Progreso de la carga del documento",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Documento reemplazado correctamente."),
    ).toBeVisible({ timeout: 30_000 });
    await page.unroute("**/solicitudes/*/documentos");

    await expect(page.getByText("Versiones anteriores (1)")).toBeVisible();
    await page.getByText("Versiones anteriores (1)").click();
    await expect(page.getByText("cedula.pdf").first()).toBeVisible();
  });
});
