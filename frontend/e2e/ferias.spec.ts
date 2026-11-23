import { expect, test } from "@playwright/test";
import { API_URL, CREDENCIALES, cabecerasApi, iniciarSesion, tokenSesion } from "./helpers";
import { eliminarFeriasPrueba } from "./limpieza-ferias";

const PREFIJO = "E2E Feria";
const ORGANIZADOR = CREDENCIALES.organizador;
const PDF = Buffer.from("%PDF-1.4\nActa de la feria de prueba\n%%EOF");

interface ZonaApi {
  id: string;
  nombre: string;
  aforoMaximo: number | null;
}

async function obtenerZona(
  page: Parameters<typeof iniciarSesion>[0],
  nombre: string,
): Promise<ZonaApi> {
  const token = await tokenSesion(page);
  const respuesta = await page.request.get(`${API_URL}/ferias/zonas`, {
    ...cabecerasApi(token),
  });
  expect(respuesta.ok()).toBeTruthy();
  const cuerpo = (await respuesta.json()) as { zonas: ZonaApi[] };
  const zona = cuerpo.zonas.find((item) => item.nombre === nombre);
  if (!zona) throw new Error(`No se encontró la zona ${nombre}`);
  return zona;
}

async function entrarAlFormulario(page: Parameters<typeof iniciarSesion>[0]) {
  await iniciarSesion(
    page,
    ORGANIZADOR.correo,
    ORGANIZADOR.password,
    "/organizador/inicio",
  );
  await page.goto("/organizador/ferias/nueva");
  await expect(
    page.getByRole("heading", { name: "Solicitar una feria" }),
  ).toBeVisible();
}

async function completarDatosBasicos(
  page: Parameters<typeof iniciarSesion>[0],
  datos: {
    nombre: string;
    zonaId: string;
    fechaInicio: string;
    fechaFin: string;
    puestos: string;
  },
  adjuntar = true,
) {
  await page.getByLabel("Nombre de la feria").fill(datos.nombre);
  await page.getByLabel("Tipo de feria").fill("Feria agroecológica");
  await page.getByLabel(/^Zona/).selectOption(datos.zonaId);
  await page.getByLabel(/^Fecha de inicio/).fill(datos.fechaInicio);
  await page.getByLabel(/^Fecha de fin/).fill(datos.fechaFin);
  await page.getByLabel(/^Número de puestos/).fill(datos.puestos);
  await page.locator('input[type="checkbox"]:not([disabled])').first().check();
  if (adjuntar) {
    await page.locator("#adjuntos-feria").setInputFiles({
      name: "acta.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
  }
}

test.describe("Solicitud de feria del organizador", () => {
  test.afterAll(async () => {
    await eliminarFeriasPrueba(ORGANIZADOR.correo, PREFIJO);
  });

  test("radica una feria con adjunto y muestra el radicado", async ({ page }) => {
    await entrarAlFormulario(page);
    const zona = await obtenerZona(page, "Centro - Calle 30");

    await completarDatosBasicos(page, {
      nombre: `${PREFIJO} Agroecológica`,
      zonaId: zona.id,
      fechaInicio: "2030-05-10",
      fechaFin: "2030-05-12",
      puestos: "10",
    });

    await expect(
      page.getByText("La zona está libre para las fechas y el número de puestos indicados."),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Radicar feria" }).click();
    await page.waitForURL(/\/organizador\/ferias\/\d+\?radicada=1/);
    await expect(
      page.getByText("Feria radicada correctamente."),
    ).toBeVisible();
    await expect(page.getByText(/^FER-\d{4}-\d{5}$/)).toBeVisible();

    const descarga = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar" }).first().click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe("acta.pdf");

    await page.goto("/notificaciones");
    const enlaceFeria = page
      .getByRole("link", { name: /Ver feria/ })
      .first();
    await expect(enlaceFeria).toBeVisible();
    await enlaceFeria.click();
    await page.waitForURL(/\/organizador\/ferias\/\d+/);
  });

  test("detecta el cruce con una feria aprobada y sugiere fechas", async ({
    page,
  }) => {
    await entrarAlFormulario(page);
    const zona = await obtenerZona(page, "Parque La Guadua");

    await completarDatosBasicos(
      page,
      {
        nombre: `${PREFIJO} Cruce`,
        zonaId: zona.id,
        fechaInicio: "2026-12-10",
        fechaFin: "2026-12-12",
        puestos: "10",
      },
      false,
    );

    await expect(
      page.getByText("Fechas alternativas disponibles"),
    ).toBeVisible({ timeout: 20_000 });
    const alternativa = page.getByRole("button", {
      name: "del 13/12/2026 al 15/12/2026",
    });
    await expect(alternativa).toBeVisible();
    await alternativa.click();

    await expect(page.getByLabel(/^Fecha de inicio/)).toHaveValue("2026-12-13");
    await expect(page.getByLabel(/^Fecha de fin/)).toHaveValue("2026-12-15");

    await page.getByRole("button", { name: "Radicar feria" }).click();
    await page.waitForURL(/\/organizador\/ferias\/\d+\?radicada=1/);
    await expect(
      page.getByText("Feria radicada correctamente."),
    ).toBeVisible();
  });

  test("no permite superar el aforo de la zona", async ({ page }) => {
    await entrarAlFormulario(page);
    const zona = await obtenerZona(page, "Parque La Guadua");

    await completarDatosBasicos(
      page,
      {
        nombre: `${PREFIJO} Aforo`,
        zonaId: zona.id,
        fechaInicio: "2030-06-10",
        fechaFin: "2030-06-11",
        puestos: "26",
      },
      false,
    );

    await expect(
      page.getByText(/supera el aforo máximo de la zona \(25\)/),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: "Radicar feria" }),
    ).toBeDisabled();
    await expect(page).toHaveURL(/\/organizador\/ferias\/nueva/);
  });

  test("el formulario se adapta a 360 px sin desplazamiento horizontal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await entrarAlFormulario(page);

    await expect(page.getByLabel("Nombre de la feria")).toBeVisible();
    const ancho = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(ancho).toBeLessThanOrEqual(361);
  });
});
