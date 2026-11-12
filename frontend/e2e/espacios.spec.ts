import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  API_URL,
  cabecerasApi,
  CREDENCIALES,
  iniciarSesion,
  tokenSesion,
} from "./helpers";

interface EspacioApi {
  id: string;
  nombre: string;
  sector: string | null;
  dimensiones: string | null;
  disponible: boolean;
  estadoEfectivo: string;
  horario: { inicio: string | null; fin: string | null };
  zona: { id: string; nombre: string } | null;
}

interface RespuestaEspaciosApi {
  datos: EspacioApi[];
  total: number;
  disponibles: number;
  noDisponibles: number;
}

async function consultarEspacios(
  request: APIRequestContext,
  page: import("@playwright/test").Page,
  consulta = "",
  incluirNoDisponibles = true,
): Promise<RespuestaEspaciosApi> {
  const token = await tokenSesion(page);
  const respuesta = await request.get(
    `${API_URL}/espacios?incluirNoDisponibles=${incluirNoDisponibles}${consulta}`,
    cabecerasApi(token),
  );
  expect(respuesta.ok()).toBeTruthy();
  return (await respuesta.json()) as RespuestaEspaciosApi;
}

async function consultarEspacio(
  request: APIRequestContext,
  page: import("@playwright/test").Page,
  id: string,
): Promise<{
  dimensiones: string | null;
  horario: { inicio: string | null; fin: string | null };
  zona: { nombre: string; productos: string[] } | null;
}> {
  const token = await tokenSesion(page);
  const respuesta = await request.get(
    `${API_URL}/espacios/${id}`,
    cabecerasApi(token),
  );
  expect(respuesta.ok()).toBeTruthy();
  return (await respuesta.json()) as {
    dimensiones: string | null;
    horario: { inicio: string | null; fin: string | null };
    zona: { nombre: string; productos: string[] } | null;
  };
}

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
    request,
  }) => {
    await entrarAEspacios(page);
    const espacios = await consultarEspacios(request, page);
    const disponibles = espacios.datos.filter((espacio) => espacio.disponible);
    const noDisponibles = espacios.datos.filter(
      (espacio) => !espacio.disponible,
    );

    await page.getByRole("button", { name: "Tabla" }).click();

    const tabla = page.getByRole("table");
    await expect(tabla).toBeVisible();
    for (const espacio of disponibles) {
      await expect(
        tabla.getByText(espacio.nombre, { exact: true }),
      ).toBeVisible();
    }
    for (const espacio of noDisponibles) {
      await expect(
        tabla.getByText(espacio.nombre, { exact: true }),
      ).toHaveCount(0);
    }
    await expect(
      page.getByText(`${disponibles.length} disponibles`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`${noDisponibles.length} no disponibles`, { exact: true }),
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

  test("abre la ficha como panel lateral en escritorio", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarAEspacios(page);
    const espacios = await consultarEspacios(request, page);
    const elegido = espacios.datos.find((espacio) => espacio.disponible);
    if (!elegido) throw new Error("No hay espacios disponibles para la ficha.");
    const detalle = await consultarEspacio(request, page, elegido.id);

    await page.getByRole("button", { name: "Tabla" }).click();

    await page
      .getByRole("button", {
        name: `Ver ficha de ${elegido.nombre}`,
      })
      .click();

    const ficha = page.getByRole("dialog");
    await expect(ficha).toBeVisible();
    await expect(
      ficha.getByRole("heading", { name: elegido.nombre }),
    ).toBeVisible();
    if (detalle.dimensiones) {
      await expect(ficha.getByText(detalle.dimensiones)).toBeVisible();
    }
    if (detalle.horario.inicio && detalle.horario.fin) {
      await expect(
        ficha.getByText(`${detalle.horario.inicio} a ${detalle.horario.fin}`),
      ).toBeVisible();
    }
    if (detalle.zona) {
      await expect(ficha.getByText(detalle.zona.nombre).first()).toBeVisible();
    }
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
    request,
  }) => {
    await entrarAEspacios(page);
    const espacios = await consultarEspacios(request, page);
    const totalDisponibles = espacios.datos.filter(
      (espacio) => espacio.disponible,
    ).length;

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
      String(totalDisponibles),
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
      .toBe(totalDisponibles);
  });

  test("abre la ficha como hoja inferior en móvil sin desbordamiento", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await entrarAEspacios(page);
    const espacios = await consultarEspacios(request, page);
    const elegido = espacios.datos.find((espacio) => espacio.disponible);
    if (!elegido) throw new Error("No hay espacios disponibles para la ficha.");
    await page.getByRole("button", { name: "Tabla" }).click();

    await page
      .getByRole("button", {
        name: `Ver ficha de ${elegido.nombre}`,
      })
      .click();

    const ficha = page.getByRole("dialog");
    await expect(ficha).toBeVisible();
    await expect(
      ficha.getByRole("heading", { name: elegido.nombre }),
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

  test("muestra el error de la API y permite reintentar", async ({
    page,
    request,
  }) => {
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
    const espacios = await consultarEspacios(request, page);
    const elegido = espacios.datos.find((espacio) => espacio.disponible);
    if (!elegido) throw new Error("No hay espacios disponibles tras reintentar.");
    await page.getByRole("button", { name: "Tabla" }).click();

    await expect(
      page
        .getByRole("table")
        .getByText(elegido.nombre, { exact: true }),
    ).toBeVisible();
  });

  test("filtra por sector y actividad y actualiza el conteo", async ({
    page,
    request,
  }) => {
    await entrarAEspacios(page);
    const panel = page.getByTestId("panel-filtros-escritorio");

    await panel.getByLabel("Sector").selectOption("Centro");
    await panel
      .getByLabel("Actividad")
      .selectOption("Venta de alimentos y frutas");
    await panel.getByRole("button", { name: "Aplicar filtros" }).click();

    const esperado = await consultarEspacios(
      request,
      page,
      "&sector=Centro&actividad=Venta%20de%20alimentos%20y%20frutas",
      false,
    );
    const textoEncontrados =
      esperado.total === 1
        ? "1 espacio encontrado"
        : `${esperado.total} espacios encontrados`;
    await expect(
      page.getByText(textoEncontrados, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`${esperado.disponibles} disponibles`, { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Tabla" }).click();
    const tabla = page.getByRole("table");
    for (const espacio of esperado.datos) {
      await expect(
        tabla.getByText(espacio.nombre, { exact: true }),
      ).toBeVisible();
    }
    await expect(
      tabla.getByText("Kiosco Parque La Guadua", { exact: true }),
    ).toHaveCount(0);
  });

  test("consulta disponibilidad por fecha y horario", async ({
    page,
    request,
  }) => {
    await entrarAEspacios(page);
    const panel = page.getByTestId("panel-filtros-escritorio");

    await panel.getByLabel("Fecha").fill("2026-11-10");
    await panel.getByLabel("Hora inicio").fill("10:00");
    await panel.getByLabel("Hora fin").fill("12:00");
    await panel.getByRole("button", { name: "Aplicar filtros" }).click();

    const esperado = await consultarEspacios(
      request,
      page,
      "&fecha=2026-11-10&horaInicio=10%3A00&horaFin=12%3A00",
      false,
    );
    const textoEncontrados =
      esperado.total === 1
        ? "1 espacio encontrado"
        : `${esperado.total} espacios encontrados`;
    await expect(
      page.getByText(textoEncontrados, { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Tabla" }).click();
    const tabla = page.getByRole("table");
    for (const espacio of esperado.datos) {
      await expect(
        tabla.getByText(espacio.nombre, { exact: true }),
      ).toBeVisible();
    }
    const noEsperados = ["Espacio móvil Calle 30 - A", "Kiosco Parque La Guadua"];
    for (const nombre of noEsperados) {
      if (!esperado.datos.some((espacio) => espacio.nombre === nombre)) {
        await expect(tabla.getByText(nombre, { exact: true })).toHaveCount(0);
      }
    }
  });

  test("muestra el estado sin resultados y permite limpiar filtros", async ({
    page,
    request,
  }) => {
    await entrarAEspacios(page);
    const panel = page.getByTestId("panel-filtros-escritorio");

    await panel.getByLabel("Sector").selectOption("Centro");
    await panel.getByLabel("Actividad").selectOption("Artesanías");
    await panel.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect(
      page.getByText("No hay espacios disponibles con esos criterios"),
    ).toBeVisible();
    await expect(page.getByText("Limpiar filtros").first()).toBeVisible();

    await page.getByRole("button", { name: "Limpiar filtros" }).first().click();

    await expect(
      page.getByText("No hay espacios disponibles con esos criterios"),
    ).toBeHidden();
    const todos = await consultarEspacios(request, page, "", false);
    const disponibles = todos.datos.filter(
      (espacio) => espacio.disponible,
    ).length;
    await expect(
      page.getByText(`${disponibles} disponibles`, { exact: true }),
    ).toBeVisible();
  });

  test("abre el panel de filtros en móvil sin desbordamiento", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await entrarAEspacios(page);

    await page
      .getByRole("button", { name: "Abrir panel de filtros" })
      .click();

    const panel = page.getByTestId("panel-filtros-movil");
    await expect(panel).toBeVisible();
    await panel.getByLabel("Sector").selectOption("Centro");
    await panel.getByRole("button", { name: "Aplicar filtros" }).click();

    const esperado = await consultarEspacios(
      request,
      page,
      "&sector=Centro",
      false,
    );
    await expect(
      page.getByText(`${esperado.total} resultados`, { exact: true }),
    ).toBeVisible();

    const desbordamiento = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(desbordamiento).toBeLessThanOrEqual(1);
  });
});
