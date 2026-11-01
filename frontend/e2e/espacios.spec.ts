import { expect, test } from "@playwright/test";
import {
  API_URL,
  cabecerasApi,
  CREDENCIALES,
  iniciarSesion,
  tokenSesion,
} from "./helpers";

const TESELA_TRANSPARENTE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function bloquearTeselas(page: import("@playwright/test").Page) {
  await page.route("https://*.tile.openstreetmap.org/**", (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: "image/png",
      body: TESELA_TRANSPARENTE,
    }),
  );
}

async function entrarAEspacios(page: import("@playwright/test").Page) {
  await iniciarSesion(
    page,
    CREDENCIALES.comerciante.correo,
    CREDENCIALES.comerciante.password,
    "/comerciante/inicio",
  );
  await page.goto("/comerciante/espacios");
  await expect(
    page.getByRole("heading", { name: "Espacios disponibles" }),
  ).toBeVisible();
}

test.describe("Espacios disponibles del comerciante", () => {
  test.beforeEach(async ({ page }) => {
    await bloquearTeselas(page);
  });

  test("muestra en la tabla solo los espacios disponibles", async ({
    page,
  }) => {
    await entrarAEspacios(page);
    await page.getByRole("button", { name: "Tabla" }).click();

    const tabla = page.getByRole("table");
    await expect(tabla).toBeVisible();
    await expect(
      tabla.getByText("Espacio móvil Calle 30 - A", { exact: true }),
    ).toBeVisible();
    await expect(
      tabla.getByText("Kiosco Parque La Guadua", { exact: true }),
    ).toBeVisible();
    await expect(
      tabla.getByText("Espacio Plaza Boyacá - Norte", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("3 disponibles", { exact: true })).toBeVisible();
    await expect(
      page.getByText("3 no disponibles", { exact: true }),
    ).toBeVisible();
  });

  test("la tabla y el mapa coinciden con la API y la base de datos", async ({
    page,
    request,
  }) => {
    await entrarAEspacios(page);
    const token = await tokenSesion(page);

    const respuesta = await request.get(
      `${API_URL}/espacios?incluirNoDisponibles=true`,
      cabecerasApi(token),
    );
    expect(respuesta.ok()).toBeTruthy();
    const cuerpo = (await respuesta.json()) as {
      datos: Array<{ id: string; nombre: string; disponible: boolean }>;
    };
    const disponibles = cuerpo.datos.filter(
      (espacio) => espacio.disponible,
    ).length;

    // El mapa debe representar exactamente los espacios disponibles.
    await expect
      .poll(
        async () => {
          const marcadores = await page
            .locator(".sgp-marcador-espacio")
            .count();
          const conteos = await page
            .locator(".sgp-cluster-espacios__conteo")
            .allTextContents();
          return (
            marcadores +
            conteos.reduce((suma, texto) => suma + Number(texto), 0)
          );
        },
        { timeout: 30_000 },
      )
      .toBe(disponibles);

    await page.getByRole("button", { name: "Tabla" }).click();
    const tabla = page.getByRole("table");

    for (const espacio of cuerpo.datos) {
      if (espacio.disponible) {
        await expect(
          tabla.getByText(espacio.nombre, { exact: true }),
        ).toBeVisible();
      } else {
        await expect(
          tabla.getByText(espacio.nombre, { exact: true }),
        ).toHaveCount(0);
      }
    }
  });

  test("abre la ficha como panel lateral en escritorio", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarAEspacios(page);
    await page.getByRole("button", { name: "Tabla" }).click();

    await page
      .getByRole("button", {
        name: "Ver ficha de Espacio móvil Calle 30 - A",
      })
      .click();

    const ficha = page.getByRole("dialog");
    await expect(ficha).toBeVisible();
    await expect(
      ficha.getByRole("heading", {
        name: "Espacio móvil Calle 30 - A",
      }),
    ).toBeVisible();
    await expect(ficha.getByText("3 × 2 m")).toBeVisible();
    await expect(ficha.getByText("06:00 a 14:00")).toBeVisible();
    await expect(ficha.getByText("Centro - Calle 30")).toBeVisible();
    await expect(ficha.getByText(/Frutas frescas/)).toBeVisible();
    await expect(ficha.getByText("40 personas")).toBeVisible();
  });

  test("permite consultar un espacio bloqueado sin presentarlo como disponible", async ({
    page,
  }) => {
    await entrarAEspacios(page);
    await page.getByLabel("Mostrar no disponibles").check();
    await page.getByRole("button", { name: "Tabla" }).click();

    const tabla = page.getByRole("table");
    await expect(
      tabla.getByText("Espacio Plaza Boyacá - Norte", { exact: true }),
    ).toBeVisible();
    await expect(
      tabla.getByText("Espacio Plaza Boyacá - Sur", { exact: true }),
    ).toBeVisible();
    await expect(
      tabla.getByText("Módulo Parque La Guadua - Este", { exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", {
        name: "Ver ficha de Espacio Plaza Boyacá - Norte",
      })
      .click();

    const ficha = page.getByRole("dialog");
    await expect(ficha).toBeVisible();
    await expect(ficha.getByText("Este espacio no está disponible.")).toBeVisible();
    await expect(
      ficha.getByText("Mantenimiento del andén", { exact: true }),
    ).toBeVisible();
    await expect(
      ficha.getByText("del 25/10/2026 al 31/10/2026", { exact: true }),
    ).toBeVisible();
    await expect(
      ficha.getByText("Plaza Boyacá", { exact: true }).first(),
    ).toBeVisible();
    await expect(ficha.getByText("15 personas")).toBeVisible();
    await expect(ficha.getByText("Artesanías, Comidas rápidas")).toBeVisible();
  });

  test("agrupa marcadores al alejar y los separa al acercar", async ({
    page,
  }) => {
    await entrarAEspacios(page);

    const mapa = page.locator(".sgp-mapa .leaflet-container");
    await expect(mapa).toBeVisible();
    await expect
      .poll(async () => page.locator(".sgp-marcador-espacio").count(), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);

    const zoomActual = async () =>
      Number(await mapa.getAttribute("data-zoom"));

    for (let intento = 0; intento < 8; intento += 1) {
      if ((await zoomActual()) <= 11) break;
      await page.locator(".leaflet-control-zoom-out").click();
      await page.waitForTimeout(350);
    }
    await expect.poll(zoomActual).toBe(11);

    await expect
      .poll(async () => page.locator(".sgp-cluster-espacios").count(), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
    await expect(page.locator(".sgp-cluster-espacios").first()).toContainText(
      "3",
    );

    for (let intento = 0; intento < 12; intento += 1) {
      if ((await zoomActual()) >= 19) break;
      await page.locator(".leaflet-control-zoom-in").click();
      await page.waitForTimeout(350);
    }
    await expect.poll(zoomActual).toBe(19);

    await expect
      .poll(async () => page.locator(".sgp-marcador-espacio").count(), {
        timeout: 30_000,
      })
      .toBe(3);
  });

  test("abre la ficha como hoja inferior en móvil sin desbordamiento", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await entrarAEspacios(page);
    await page.getByRole("button", { name: "Tabla" }).click();

    await page
      .getByRole("button", {
        name: "Ver ficha de Espacio móvil Calle 30 - A",
      })
      .click();

    const ficha = page.getByRole("dialog");
    await expect(ficha).toBeVisible();
    await expect(
      ficha.getByRole("heading", {
        name: "Espacio móvil Calle 30 - A",
      }),
    ).toBeVisible();

    const desbordamiento = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(desbordamiento).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Cerrar ficha", exact: true }).click();
    await expect(ficha).toBeHidden();
  });

  test("muestra el error de la API y permite reintentar", async ({ page }) => {
    await page.route(`${API_URL}/espacios*`, (ruta) =>
      ruta.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 500,
          message: "Fallo de prueba al cargar los espacios",
          error: "Internal Server Error",
        }),
      }),
    );

    await entrarAEspacios(page);
    await expect(
      page.getByText("Fallo de prueba al cargar los espacios"),
    ).toBeVisible();

    await page.unroute(`${API_URL}/espacios*`);
    await page.getByRole("button", { name: "Reintentar" }).first().click();
    await page.getByRole("button", { name: "Tabla" }).click();

    await expect(
      page
        .getByRole("table")
        .getByText("Espacio móvil Calle 30 - A", { exact: true }),
    ).toBeVisible();
  });
});
