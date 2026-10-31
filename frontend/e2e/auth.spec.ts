import { expect, test } from "@playwright/test";
import {
  CREDENCIALES,
  campo,
  cerrarSesion,
  iniciarSesion,
} from "./helpers";

test.describe("Autenticación y sesión", () => {
  test("un comerciante inicia sesión y llega a su inicio", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );

    await expect(
      page.getByRole("heading", { name: /Hola, María/ }),
    ).toBeVisible();
    await expect(
      page.getByText("Venta de frutas y verduras", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Estado de la cuenta")).toBeVisible();
  });

  test("un organizador inicia sesión y llega a su inicio", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.organizador.correo,
      CREDENCIALES.organizador.password,
      "/organizador/inicio",
    );

    await expect(
      page.getByRole("heading", { name: /Hola, Luis/ }),
    ).toBeVisible();
    await expect(
      page.getByText("Fundación Agroecológica del Valle"),
    ).toBeVisible();
  });

  test("un administrador inicia sesión y llega al panel", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
      "/gestor/panel",
    );

    await expect(
      page.getByRole("heading", { name: /Bienvenido, Laura/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cuentas de usuario" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Gestionar usuarios" }),
    ).toBeVisible();
  });

  test("un revisor inicia sesión y ve su alcance", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );

    await expect(page.getByText(/Perfil de acceso:/)).toBeVisible();
    await expect(
      page.getByText(/las acciones de escritura están reservadas/),
    ).toBeVisible();
  });

  test("las credenciales inválidas muestran un error", async ({ page }) => {
    await page.goto("/login");
    await campo(page, "Correo electrónico").fill(
      CREDENCIALES.comerciante.correo,
    );
    await campo(page, "Contraseña").fill("PasswordIncorrecta123");
    await page.getByRole("button", { name: "Iniciar Sesión" }).click();

    await expect(page.getByText("Credenciales inválidas")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("el cierre de sesión vuelve al login", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );

    await cerrarSesion(page);
    await expect(
      page.getByRole("link", { name: "Iniciar Sesión" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
