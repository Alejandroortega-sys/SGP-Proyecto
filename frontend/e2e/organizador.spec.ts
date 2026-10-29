import { expect, test } from "@playwright/test";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  campo,
  iniciarSesion,
  tokenSesion,
} from "./helpers";

const CONTACTO_ORIGINAL = "3105551234";
const CONTACTO_PRUEBA = "3105559999";

test.describe("Módulo del organizador", () => {
  test("consulta su inicio y el estado de su organización", async ({ page }) => {
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
      page.getByText("Fundación Agroecológica del Valle").first(),
    ).toBeVisible();
    await expect(page.getByText("Activa", { exact: true }).first()).toBeVisible();

    await page.getByRole("link", { name: "Mi perfil", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Mi perfil" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Gestionar mi organización/ }),
    ).toBeVisible();
  });

  test("edita el contacto de su organización", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.organizador.correo,
      CREDENCIALES.organizador.password,
      "/organizador/inicio",
    );
    await page.goto("/organizador/mi-organizacion");

    await expect(
      page.getByRole("heading", { name: "Mi organización" }),
    ).toBeVisible();
    await expect(
      page.getByText("Fundación Agroecológica del Valle").first(),
    ).toBeVisible();

    try {
      await page
        .getByRole("button", { name: "Editar organización" })
        .click();
      await campo(page, "Contacto").fill(CONTACTO_PRUEBA);
      await page.getByRole("button", { name: "Guardar cambios" }).click();

      await expect(page.getByText(/Organización actualizada/)).toBeVisible();

      await page.reload();
      await expect(page.getByText(CONTACTO_PRUEBA)).toBeVisible();
    } finally {
      const token = await tokenSesion(page);
      await page.request.patch(`${API_URL}/organizadores/mi-organizacion`, {
        ...cabecerasApi(token),
        data: { contacto: CONTACTO_ORIGINAL },
      });
    }
  });
});
