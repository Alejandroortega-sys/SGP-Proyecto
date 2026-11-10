import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { CREDENCIALES, iniciarSesion } from "./helpers";
import { eliminarImportacionesPrueba } from "./limpieza-importaciones";

const PREFIJO = "E2E Importación";

function geojsonZonas(): Buffer {
  const contenido = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          nombre: `${PREFIJO} zona`,
          tipo: "permitida",
          aforoMaximo: 10,
          productosPermitidos: "Frutas frescas",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-76.23, 4.12],
              [-76.228, 4.12],
              [-76.228, 4.122],
              [-76.23, 4.122],
              [-76.23, 4.12],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { nombre: "", tipo: "permitida" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-76.23, 4.12],
              [-76.228, 4.12],
              [-76.228, 4.122],
              [-76.23, 4.122],
              [-76.23, 4.12],
            ],
          ],
        },
      },
    ],
  };

  return Buffer.from(JSON.stringify(contenido), "utf8");
}

const CSV_MODULOS =
  "categoria,actividad,latitud,longitud,titular_documento,titular_nombre\r\n" +
  `informal,${PREFIJO} módulo válido,4.0885,-76.1955,1032456789,\r\n` +
  `otra,${PREFIJO} módulo inválido,4.0885,-76.1955,,\r\n` +
  `formal,${PREFIJO} módulo restringido,4.0905,-76.194,,Nombre E2E\r\n`;

async function subirArchivo(
  page: Parameters<typeof iniciarSesion>[0],
  nombre: string,
  tipo: string,
  contenido: Buffer,
): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles({
    name: nombre,
    mimeType: tipo,
    buffer: contenido,
  });
}

test.describe("Importación de zonas y módulos", () => {
  test.beforeAll(async () => {
    await eliminarImportacionesPrueba(PREFIJO);
  });

  test.afterEach(async () => {
    await eliminarImportacionesPrueba(PREFIJO);
  });

  test("el administrador ve ambas pestañas y el revisor solo módulos", async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/importaciones");

    await expect(
      page.getByRole("tab", { name: /Zonas \(GeoJSON\)/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Módulos \(CSV\)/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await page.waitForURL("**/login");

    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/importaciones");

    await expect(
      page.getByRole("tab", { name: /Módulos \(CSV\)/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Zonas \(GeoJSON\)/ }),
    ).toHaveCount(0);
  });

  test("importa parcialmente un GeoJSON, muestra el mapa y descarga el reporte", async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/importaciones");

    await subirArchivo(page, "zonas.geojson", "application/geo+json", geojsonZonas());
    await page.getByRole("button", { name: "Previsualizar archivo" }).click();

    await expect(
      page.getByRole("heading", { name: "Resumen de la previsualización" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Mapa de previsualización de la importación"),
    ).toBeVisible();
    await expect(page.getByText(/Válidas/).first()).toBeVisible();
    await expect(
      page.getByText("Rechazada", { exact: true }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Confirmar importación" }).click();
    await expect(page.getByText(/Importación confirmada/)).toBeVisible();

    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: /Descargar reporte de errores/ })
        .click(),
    ]);

    const ruta = await descarga.path();
    expect(ruta).not.toBeNull();
    const contenido = await readFile(ruta as string, "utf8");
    expect(contenido).toContain("Reporte de importación de zonas");
    expect(contenido).toContain("Rechazados: 1");

    await page.getByRole("link", { name: "Ver zonas" }).click();
    await page.waitForURL("**/gestor/zonas");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(`${PREFIJO} zona`).first()).toBeVisible();
  });

  test("importa un CSV parcial, confirma zona restringida y descarga el reporte", async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/importaciones");
    await page.getByRole("tab", { name: /Módulos \(CSV\)/ }).click();

    await subirArchivo(page, "modulos.csv", "text/csv", Buffer.from(CSV_MODULOS));
    await page.getByRole("button", { name: "Previsualizar archivo" }).click();

    await expect(
      page.getByRole("heading", { name: "Resumen de la previsualización" }),
    ).toBeVisible();
    await expect(page.getByText("Con advertencia").first()).toBeVisible();
    await expect(
      page.getByRole("checkbox", {
        name: /Confirmo importar las filas ubicadas en zona restringida/,
      }),
    ).toBeVisible();

    await page
      .getByRole("checkbox", {
        name: /Confirmo importar las filas ubicadas en zona restringida/,
      })
      .check();
    await page.getByRole("button", { name: "Confirmar importación" }).click();

    await expect(page.getByText(/Importación confirmada/)).toBeVisible();
    await expect(page.getByText(/Se importaron/).first()).toBeVisible();

    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: /Descargar reporte de errores/ })
        .click(),
    ]);

    const ruta = await descarga.path();
    expect(ruta).not.toBeNull();
    const contenido = await readFile(ruta as string, "utf8");
    expect(contenido).toContain("Reporte de importación de módulos");
    expect(contenido).toContain("Rechazados: 1");
    expect(contenido).toContain(`${PREFIJO} módulo inválido`);

    await page.getByRole("link", { name: "Ver módulos" }).click();
    await page.waitForURL("**/gestor/modulos");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(`${PREFIJO} módulo válido`).first(),
    ).toBeVisible();
  });

  test("muestra un error claro cuando el CSV tiene formato incorrecto", async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/importaciones");
    await page.getByRole("tab", { name: /Módulos \(CSV\)/ }).click();

    await subirArchivo(
      page,
      "modulos.csv",
      "text/csv",
      Buffer.from("categoria,actividad\r\ninformal,Empanadas\r\n"),
    );
    await page.getByRole("button", { name: "Previsualizar archivo" }).click();

    await expect(
      page.getByRole("alert").filter({
        hasText: /faltan las columnas obligatorias/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirmar importación" }),
    ).toHaveCount(0);
  });

  test("la pantalla funciona a 360 px sin desplazamiento horizontal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/importaciones");

    await expect(
      page.getByRole("tab", { name: /Zonas \(GeoJSON\)/ }),
    ).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();

    const ancho = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(ancho).toBeLessThanOrEqual(360);
  });
});
