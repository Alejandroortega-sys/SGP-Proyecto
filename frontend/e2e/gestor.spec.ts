import { expect, test, type Page } from "@playwright/test";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  campo,
  iniciarSesion,
  tokenSesion,
} from "./helpers";

const CORREO_GESTOR_E2E = "e2e.gestor@tulua.gov.co";

async function abrirDetalleComerciante(page: Page): Promise<string> {
  await page.goto("/gestor/usuarios");
  await campo(page, "Buscar").fill("María");
  await page.getByRole("button", { name: "Filtrar" }).click();
  const fila = page.getByRole("row", { name: /María Gómez/ });
  await expect(fila).toBeVisible();
  await fila.getByRole("link", { name: "Ver detalle" }).click();
  await page.waitForURL(/\/gestor\/usuarios\/\d+$/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

async function abrirDetalleOrganizacion(page: Page): Promise<string> {
  await page.goto("/gestor/organizaciones");
  await campo(page, "Buscar").fill("Fundación Agroecológica");
  await page.getByRole("button", { name: "Filtrar" }).click();
  const fila = page.getByRole("row", {
    name: /Fundación Agroecológica del Valle/,
  });
  await expect(fila).toBeVisible();
  await fila.getByRole("link", { name: "Ver detalle" }).click();
  await page.waitForURL(/\/gestor\/organizaciones\/\d+$/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

test.describe("Módulo del gestor", () => {
  test("el panel muestra los indicadores generales", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );

    await expect(
      page.getByRole("heading", { name: "Cuentas de usuario" }),
    ).toBeVisible();
    await expect(page.getByText("Total registrado:")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cuentas por rol" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Trámites" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Revisar organizaciones" }),
    ).toBeVisible();
  });

  test("lista, filtra y consulta el detalle de una cuenta", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );

    await page.goto("/gestor/usuarios");
    await expect(
      page.getByRole("heading", { name: "Cuentas de usuario" }),
    ).toBeVisible();

    await campo(page, "Buscar").fill("María");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(
      page.getByRole("row", { name: /María Gómez/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Limpiar" }).click();
    await campo(page, "Rol").selectOption("organizador");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(
      page.getByRole("row", { name: /Luis Álvarez/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Limpiar" }).click();
    const fila = page.getByRole("row", { name: /María Gómez/ });
    await expect(fila).toBeVisible();
    await fila.getByRole("link", { name: "Ver detalle" }).click();
    await page.waitForURL(/\/gestor\/usuarios\/\d+$/);

    await expect(
      page.getByRole("heading", { name: "María Gómez" }),
    ).toBeVisible();
    await expect(
      page.getByText("Venta de frutas y verduras").first(),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Solicitudes/ }).click();
    await expect(page.getByText(/SOL-2026-0000/).first()).toBeVisible();

    await page.getByRole("button", { name: /^Permisos/ }).click();
    await expect(page.getByText("PER-2026-00001").first()).toBeVisible();

    await page.getByRole("button", { name: "Datos", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Datos de la cuenta" }),
    ).toBeVisible();
  });

  test("suspende y reactiva una cuenta", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    const id = await abrirDetalleComerciante(page);

    try {
      await page.getByRole("button", { name: "Suspender", exact: true }).click();
      const dialogo = page.getByRole("dialog");
      await expect(dialogo).toBeVisible();
      await dialogo.getByLabel("Motivo").fill("Prueba de usabilidad E2E");
      await dialogo
        .getByRole("button", { name: "Confirmar cambio" })
        .click();

      await expect(page.getByText(/Cuenta suspendida/)).toBeVisible();
      await expect(
        page.getByText("Suspendida", { exact: true }).first(),
      ).toBeVisible();

      await page.getByRole("button", { name: "Activar", exact: true }).click();
      const dialogoActivacion = page.getByRole("dialog");
      await expect(dialogoActivacion).toBeVisible();
      await dialogoActivacion
        .getByRole("button", { name: "Confirmar cambio" })
        .click();

      await expect(page.getByText(/Cuenta activada/)).toBeVisible();
      await expect(
        page.getByText("Activa", { exact: true }).first(),
      ).toBeVisible();
    } finally {
      const token = await tokenSesion(page);
      if (id) {
        await page.request.patch(`${API_URL}/gestor/usuarios/${id}/estado`, {
          ...cabecerasApi(token),
          data: { estado: "activa" },
        });
      }
    }
  });

  test("corrige los datos sensibles de un comerciante", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    const id = await abrirDetalleComerciante(page);

    try {
      const actividad = campo(page, "Actividad comercial");
      await actividad.fill("Venta de frutas y verduras (E2E)");
      await page.getByRole("button", { name: "Guardar corrección" }).click();

      await expect(
        page.getByText(/Datos del comerciante actualizados/),
      ).toBeVisible();
    } finally {
      const token = await tokenSesion(page);
      if (id) {
        await page.request.patch(`${API_URL}/usuarios/${id}/comerciante`, {
          ...cabecerasApi(token),
          data: {
            documento: "1032456789",
            tipoDocumento: "CC",
            actividadComercial: "Venta de frutas y verduras",
            categoria: "formal",
          },
        });
      }
    }
  });

  test("crea un gestor y reenvía su invitación", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/gestores/nuevo");

    await campo(page, "Nombres").fill("E2E");
    await campo(page, "Apellidos").fill("Prueba");
    await campo(page, "Correo institucional").fill(CORREO_GESTOR_E2E);
    await campo(page, "Perfil").selectOption("revisor");
    await page.getByRole("button", { name: "Crear gestor" }).click();

    const exito = page.getByText(/Cuenta de gestor creada/);
    const duplicado = page.getByText(/El correo ya está registrado/);
    await expect(exito.or(duplicado)).toBeVisible();

    if (await exito.isVisible()) {
      await page.getByRole("link", { name: "Ver la cuenta creada" }).click();
      await page.waitForURL(/\/gestor\/usuarios\/\d+$/);
    } else {
      await page.goto("/gestor/usuarios");
      await campo(page, "Buscar").fill(CORREO_GESTOR_E2E);
      await page.getByRole("button", { name: "Filtrar" }).click();
      await page
        .getByRole("row", { name: new RegExp(CORREO_GESTOR_E2E) })
        .getByRole("link", { name: "Ver detalle" })
        .click();
      await page.waitForURL(/\/gestor\/usuarios\/\d+$/);
    }

    await expect(
      page.getByText("Pendiente de activación", { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Reenviar invitación", exact: true })
      .click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await dialogo
      .getByRole("button", { name: "Reenviar invitación" })
      .click();

    await expect(page.getByText(/Invitación reenviada/)).toBeVisible();
  });

  test("consulta, suspende y reactiva una organización", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    const id = await abrirDetalleOrganizacion(page);

    await expect(
      page.getByRole("heading", { name: "Fundación Agroecológica del Valle" }),
    ).toBeVisible();
    await expect(page.getByText("Luis Álvarez").first()).toBeVisible();

    try {
      await page.getByRole("button", { name: "Suspender", exact: true }).click();
      const dialogo = page.getByRole("dialog");
      await expect(dialogo).toBeVisible();
      await dialogo
        .getByLabel("Motivo")
        .fill("Prueba de usabilidad E2E");
      await dialogo.getByRole("button", { name: "Suspender" }).click();

      await expect(
        page.getByText("Organización actualizada correctamente."),
      ).toBeVisible();
      await expect(
        page.getByText("Suspendida", { exact: true }).first(),
      ).toBeVisible();

      await page.getByRole("button", { name: "Activar", exact: true }).click();
      const dialogoActivacion = page.getByRole("dialog");
      await expect(dialogoActivacion).toBeVisible();
      await dialogoActivacion.getByRole("button", { name: "Activar" }).click();

      await expect(
        page.getByText("Organización actualizada correctamente."),
      ).toBeVisible();
      await expect(
        page.getByText("Activa", { exact: true }).first(),
      ).toBeVisible();
    } finally {
      const token = await tokenSesion(page);
      if (id) {
        await page.request.patch(
          `${API_URL}/gestor/organizaciones/${id}/estado`,
          {
            ...cabecerasApi(token),
            data: { estado: "activa" },
          },
        );
      }
    }
  });

  test("consulta y filtra la auditoría", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );
    await page.goto("/gestor/auditoria");

    await expect(
      page.getByRole("heading", { name: "Auditoría" }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "usuarios" }).first(),
    ).toBeVisible();

    await campo(page, "Tabla").fill("usuarios");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(
      page.getByRole("cell", { name: "usuarios" }).first(),
    ).toBeVisible();

    await campo(page, "Acción").selectOption("update");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(
      page.getByRole("cell", { name: "Actualización" }).first(),
    ).toBeVisible();

    await page.getByText("Ver valores").first().click();
    await expect(page.getByText("Anterior").first()).toBeVisible();
    await expect(page.getByText("Nuevo").first()).toBeVisible();
  });

  test("el revisor no ve acciones de administrador", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );

    await page.goto("/gestor/usuarios");
    await expect(
      page.getByRole("link", { name: "Crear gestor" }),
    ).toHaveCount(0);
    await expect(
      campo(page, "Perfil de gestor"),
    ).toHaveCount(0);
    await expect(
      campo(page, "Rol").locator("option[value='gestor']"),
    ).toHaveCount(0);

    await campo(page, "Buscar").fill("María");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await page
      .getByRole("row", { name: /María Gómez/ })
      .getByRole("link", { name: "Ver detalle" })
      .click();
    await page.waitForURL(/\/gestor\/usuarios\/\d+$/);

    await expect(
      page.getByText("Acciones de administrador:"),
    ).toHaveCount(0);
    await expect(
      page.getByText("Corregir datos sensibles del comerciante"),
    ).toBeVisible();

    await page.goto("/gestor/auditoria");
    await expect(
      page.getByText(/Solo un gestor con perfil administrador/),
    ).toBeVisible();

    await page.goto("/gestor/gestores/nuevo");
    await expect(
      page.getByText(/Solo un gestor con perfil administrador/),
    ).toBeVisible();
  });
});
