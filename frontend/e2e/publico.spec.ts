import { expect, test } from "@playwright/test";
import { campo } from "./helpers";

test.describe("Módulos públicos", () => {
  test("el registro de comerciante valida los campos obligatorios", async ({
    page,
  }) => {
    await page.goto("/registro/comerciante");
    await page.getByRole("button", { name: "Crear mi Cuenta" }).click();

    await expect(
      page.getByText(/Revisa los campos marcados con \*/),
    ).toBeVisible();
    await expect(page.getByText(/al menos 2 caracteres/).first()).toBeVisible();
    await expect(
      page.getByText("El teléfono es obligatorio."),
    ).toBeVisible();
  });

  test("el registro rechaza un correo ya registrado", async ({ page }) => {
    await page.goto("/registro/comerciante");

    await campo(page, "Nombres").fill("Prueba");
    await campo(page, "Apellidos").fill("E2E");
    await campo(page, "Número de Documento").fill(`E2E${Date.now()}`);
    await campo(page, "Teléfono / Celular").fill("3001234567");
    await campo(page, "Correo electrónico").fill("maria.gomez@gmail.com");
    await campo(page, "Actividad Comercial").fill("Venta de prueba E2E");
    await campo(page, "Contraseña").fill("PruebaE2E123");
    await campo(page, "Confirmar Contraseña").fill("PruebaE2E123");

    await page.getByRole("button", { name: "Crear mi Cuenta" }).click();

    await expect(
      page.getByText("El correo ya está registrado"),
    ).toBeVisible();
  });

  test("la recuperación de contraseña responde con un mensaje genérico", async ({
    page,
  }) => {
    await page.goto("/recuperar");
    await campo(page, "Correo electrónico").fill("maria.gomez@gmail.com");
    await page
      .getByRole("button", { name: "Enviar código de recuperación" })
      .click();

    await expect(
      page.getByText(/Si el correo corresponde a una cuenta activa/),
    ).toBeVisible();
  });

  test("la pantalla de activación muestra el formulario de 6 dígitos", async ({
    page,
  }) => {
    await page.goto("/activar?correo=pedro.sanchez@gmail.com");

    await expect(
      page.getByRole("heading", { name: "Activa tu Cuenta" }),
    ).toBeVisible();
    for (let indice = 1; indice <= 6; indice += 1) {
      await expect(
        campo(page, `Dígito ${indice} de 6`),
      ).toBeVisible();
    }
  });

  test("el primer acceso de gestor está disponible", async ({ page }) => {
    await page.goto("/primer-acceso?correo=ana.lopez@tulua.gov.co");

    await expect(
      page.getByRole("heading", { name: "Primer Acceso de Gestor Municipal" }),
    ).toBeVisible();
    await expect(campo(page, "Correo institucional")).toHaveValue(
      "ana.lopez@tulua.gov.co",
    );
    await expect(
      campo(page, "Contraseña Temporal"),
    ).toBeVisible();
  });
});
