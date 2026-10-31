import { expect, test } from "@playwright/test";

const TESELA_TRANSPARENTE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

/**
 * Evita que las pruebas dependan de internet: cualquier tesela de
 * OpenStreetMap se responde con un PNG transparente de 1×1.
 */
async function bloquearTeselas(page: import("@playwright/test").Page) {
  await page.route("https://*.tile.openstreetmap.org/**", (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: "image/png",
      body: TESELA_TRANSPARENTE,
    }),
  );
}

async function esperarPoligonos(
  page: import("@playwright/test").Page,
  cantidadMinima = 1,
) {
  await expect
    .poll(
      async () =>
        page.locator(".leaflet-overlay-pane path").count(),
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(cantidadMinima);
}

test.describe("Mapa público de zonas", () => {
  test.beforeEach(async ({ page }) => {
    await bloquearTeselas(page);
  });

  test("carga sin sesión, muestra el mapa, la leyenda y los polígonos", async ({
    page,
  }) => {
    await page.goto("/mapa");

    await expect(
      page.getByRole("heading", {
        name: "Zonas del espacio público de Tuluá",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Capas del mapa" }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /Permitida/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /Restringida/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /Alta congestión/ }),
    ).toBeVisible();

    await esperarPoligonos(page);
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });

  test("solicita el GeoJSON con el zoom y lo actualiza al alejarse", async ({
    page,
  }) => {
    const zooms: string[] = [];
    page.on("request", (peticion) => {
      if (!peticion.url().includes("/zonas/geojson")) return;
      zooms.push(new URL(peticion.url()).searchParams.get("zoom") ?? "");
    });

    await page.goto("/mapa");
    await esperarPoligonos(page);
    expect(zooms).toContain("16");

    await page.locator(".leaflet-control-zoom-out").click();

    await expect.poll(() => zooms).toContain("15");
  });

  test("abre el popup con el detalle de una zona", async ({ page }) => {
    await page.goto("/mapa");
    await esperarPoligonos(page);

    await page.locator(".leaflet-overlay-pane path").first().click({
      force: true,
    });

    const popup = page.locator(".leaflet-popup-content");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("Centro - Calle 30");
    await expect(popup).toContainText("Permitida");
    await expect(popup).toContainText("06:00 a 18:00");
    await expect(popup).toContainText("40 personas");
    await expect(popup).toContainText("Frutas frescas");
  });

  test("permite ocultar y volver a mostrar una capa", async ({ page }) => {
    await page.goto("/mapa");
    await esperarPoligonos(page);

    const permitidas = page.getByRole("checkbox", { name: /Permitida/ });
    const cantidadInicial = await page
      .locator(".leaflet-overlay-pane path")
      .count();

    await permitidas.uncheck();
    await expect
      .poll(async () => page.locator(".leaflet-overlay-pane path").count())
      .toBeLessThan(cantidadInicial);

    const cantidadOculta = await page
      .locator(".leaflet-overlay-pane path")
      .count();

    await permitidas.check();
    await expect
      .poll(async () => page.locator(".leaflet-overlay-pane path").count())
      .toBeGreaterThan(cantidadOculta);
  });

  test("muestra un error y permite reintentar la carga", async ({ page }) => {
    await page.route("**/zonas/geojson*", (ruta) =>
      ruta.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 500,
          message: "Fallo de prueba al cargar las zonas",
          error: "Internal Server Error",
        }),
      }),
    );

    await page.goto("/mapa");

    await expect(
      page.getByText("Fallo de prueba al cargar las zonas"),
    ).toBeVisible();

    await page.unroute("**/zonas/geojson*");
    await page.getByRole("button", { name: "Reintentar" }).click();

    await esperarPoligonos(page);
  });

  test("centra el mapa en la ubicación del usuario", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["geolocation"], {
      origin: "http://localhost:3001",
    });
    await context.setGeolocation({ latitude: 4.0847, longitude: -76.1954 });

    await page.goto("/mapa");
    await esperarPoligonos(page);

    await page.getByRole("button", { name: "Mi ubicación" }).click();

    await expect(
      page.getByText("Mapa centrado en tu ubicación."),
    ).toBeVisible();
  });

  test("avisa cuando la ubicación está fuera de Tuluá", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["geolocation"], {
      origin: "http://localhost:3001",
    });
    await context.setGeolocation({ latitude: 4.711, longitude: -74.0721 });

    await page.goto("/mapa");
    await esperarPoligonos(page);

    await page.getByRole("button", { name: "Mi ubicación" }).click();

    await expect(
      page.getByText(/Tu ubicación está fuera de Tuluá/),
    ).toBeVisible();
  });

  test("avisa cuando el usuario niega el permiso de ubicación", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (
            _exito: PositionCallback,
            error?: PositionErrorCallback,
          ) => {
            error?.({
              code: 1,
              message: "Permiso denegado",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
          },
        },
      });
    });

    await page.goto("/mapa");
    await esperarPoligonos(page);

    await page.getByRole("button", { name: "Mi ubicación" }).click();

    await expect(
      page.getByText(/No diste permiso para usar tu ubicación/),
    ).toBeVisible();
  });

  test("funciona a 360 px sin desplazamiento horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/mapa");
    await esperarPoligonos(page);

    const desbordamiento = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(desbordamiento).toBeLessThanOrEqual(1);

    await expect(
      page.getByRole("button", { name: "Mi ubicación" }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Capas del mapa" }),
    ).toBeVisible();
  });
});
