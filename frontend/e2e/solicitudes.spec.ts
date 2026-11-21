import { expect, test } from "@playwright/test";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  campo,
  cerrarSesion,
  iniciarSesion,
  tokenSesion,
} from "./helpers";
import { eliminarSolicitudesPrueba } from "./limpieza-solicitudes";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
);

function fechaFutura(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const FECHA_INICIO = fechaFutura(30);
const FECHA_FIN = fechaFutura(32);

test.describe.configure({ mode: "serial" });

test.describe("Solicitudes de ubicación temporal (HU-16)", () => {
  let solicitudId: string | null = null;

  test.afterAll(async () => {
    const ids = await eliminarSolicitudesPrueba(
      CREDENCIALES.comerciante.correo,
      "E2E SOLICITUD",
    );
    for (const id of ids) {
      await rm(
        resolve(process.cwd(), "..", "uploads-privados", "solicitudes", id),
        { recursive: true, force: true },
      );
    }
    solicitudId = null;
  });

  test("guarda y recupera un borrador local, y lo descarta", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );

    await page.goto("/comerciante/solicitudes/nueva");
    await page
      .getByRole("button", { name: "Seleccionar Kiosco Parque La Guadua" })
      .click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await campo(page, "Actividad").fill("E2E SOLICITUD borrador local");
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
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(
      page.getByText("Borrador guardado en este navegador"),
    ).toBeVisible();

    await page.goto("/comerciante/solicitudes");
    await expect(page.getByText("Borrador sin radicar")).toBeVisible();
    await page.getByRole("link", { name: "Continuar" }).click();

    await expect(page.getByText("cedula.pdf")).toBeVisible();
    await expect(page.getByText("rut.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Descartar borrador" }).click();
    await page.getByRole("button", { name: "Descartar", exact: true }).click();
    await expect(page.getByText("Borrador descartado.")).toBeVisible();
  });

  test("elimina el borrador local al cerrar sesión", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );

    await page.goto("/comerciante/solicitudes/nueva");
    await page
      .getByRole("button", { name: "Seleccionar Kiosco Parque La Guadua" })
      .click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await campo(page, "Actividad").fill("E2E SOLICITUD borrador logout");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(
      page.getByText("Borrador guardado en este navegador"),
    ).toBeVisible();

    await cerrarSesion(page);

    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );
    await page.goto("/comerciante/solicitudes");
    await expect(page.getByText("Borrador sin radicar")).toHaveCount(0);
  });

  test("radica una solicitud válida y muestra la confirmación", async ({
    page,
    request,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );

    await page.goto("/comerciante/solicitudes/nueva");
    await page
      .getByRole("button", { name: "Seleccionar Kiosco Parque La Guadua" })
      .click();
    await page.getByRole("button", { name: "Continuar" }).click();

    await campo(page, "Actividad").fill("E2E SOLICITUD válida");
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
    await campo(page, "Hora de inicio").fill("07:00");
    await campo(page, "Hora de fin").fill("12:00");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.getByText(/El horario debe estar entre 08:00 y 18:00/),
    ).toBeVisible();

    await campo(page, "Hora de inicio").fill("09:00");
    await expect(
      page.getByText(
        "El espacio está disponible para las fechas y el horario indicados.",
      ),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.getByRole("heading", { name: "Resumen y radicación" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Radicar solicitud" }).click();

    await page.waitForURL("**/confirmacion**", { timeout: 30_000 });
    await expect(page.getByText(/^SOL-\d{4}-\d{5}$/)).toBeVisible();

    const token = await tokenSesion(page);
    const respuesta = await request.get(
      `${API_URL}/solicitudes/mias?limite=20`,
      cabecerasApi(token),
    );
    expect(respuesta.ok()).toBeTruthy();
    const cuerpo = (await respuesta.json()) as {
      datos: Array<{ id: string; numeroRadicado: string; actividad: string }>;
    };
    const creada = cuerpo.datos.find(
      (solicitud) => solicitud.actividad === "E2E SOLICITUD válida",
    );
    expect(creada).toBeTruthy();
    solicitudId = creada?.id ?? null;

    await page.goto(`/comerciante/solicitudes/${solicitudId}`);
    await expect(page.getByText("Historial de estados")).toBeVisible();
    await expect(page.getByText("Radicada", { exact: true }).first()).toBeVisible();
  });

  test("muestra el borrador local en Mis solicitudes solo mientras exista", async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );
    await page.goto("/comerciante/solicitudes");
    await expect(page.getByText("Borrador sin radicar")).toHaveCount(0);
    await expect(
      page.getByText("E2E SOLICITUD válida").first(),
    ).toBeVisible();
  });
});
