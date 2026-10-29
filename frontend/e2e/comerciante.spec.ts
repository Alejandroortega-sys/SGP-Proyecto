import { expect, test } from "@playwright/test";
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  campo,
  iniciarSesion,
  tokenSesion,
} from "./helpers";

const TELEFONO_ORIGINAL = "3214567890";
const TELEFONO_PRUEBA = "3009998877";

test.describe("Módulo del comerciante", () => {
  test("consulta su inicio y edita su teléfono", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );

    await page.goto("/comerciante/perfil");
    await expect(
      page.getByRole("heading", { name: "Mi perfil" }),
    ).toBeVisible();
    await expect(
      campo(page, "Número de documento"),
    ).toHaveValue("1032456789");
    await expect(
      campo(page, "Número de documento"),
    ).toBeDisabled();

    try {
      const telefono = campo(page, "Teléfono");
      await telefono.fill(TELEFONO_PRUEBA);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(
        page.getByText("Datos personales actualizados correctamente."),
      ).toBeVisible();

      await page.reload();
      await expect(
        campo(page, "Teléfono"),
      ).toHaveValue(TELEFONO_PRUEBA);
    } finally {
      const token = await tokenSesion(page);
      await page.request.patch(`${API_URL}/perfil`, {
        ...cabecerasApi(token),
        data: { telefono: TELEFONO_ORIGINAL },
      });
    }
  });

  test("valida que las contraseñas coincidan antes de cambiarla", async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );
    await page.goto("/comerciante/perfil");

    await campo(page, "Contraseña actual").fill("Comerciante123");
    await campo(page, "Nueva contraseña").fill("NuevaClave456");
    await campo(page, "Confirmar nueva contraseña").fill("OtraClave456");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();

    await expect(
      page.getByText("Las contraseñas no coinciden."),
    ).toBeVisible();
  });

  test("consulta sus notificaciones desde el inicio", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );

    await page.getByRole("link", { name: /^Notificaciones/ }).first().click();
    await expect(
      page.getByRole("heading", { name: "Notificaciones" }),
    ).toBeVisible();
  });
});
