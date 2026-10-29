import { expect, test } from "@playwright/test";
import {
  CREDENCIALES,
  campo,
  iniciarSesion,
  marcarNotificacionApi,
  obtenerNotificaciones,
  tokenSesion,
} from "./helpers";

test.describe("Bandeja de notificaciones", () => {
  test("marca una notificación como leída", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );
    await page.goto("/notificaciones");

    const token = await tokenSesion(page);
    const notificaciones = await obtenerNotificaciones(page.request, token);
    const objetivo = notificaciones[0];

    if (objetivo) {
      await marcarNotificacionApi(page.request, token, objetivo.id, false);
      await page.reload();
    }

    try {
      const boton = page
        .getByRole("button", { name: "Marcar como leída" })
        .first();
      await expect(boton).toBeVisible();
      const noLeidasAntes = await page
        .getByText("No leída", { exact: true })
        .count();

      await boton.click();

      await expect(
        page.getByText("No leída", { exact: true }),
      ).toHaveCount(Math.max(noLeidasAntes - 1, 0));
    } finally {
      if (objetivo) {
        await marcarNotificacionApi(page.request, token, objetivo.id, false);
      }
    }
  });

  test("marca todas las notificaciones como leídas", async ({ page }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      "/comerciante/inicio",
    );
    await page.goto("/notificaciones");

    const token = await tokenSesion(page);
    const notificaciones = await obtenerNotificaciones(page.request, token);
    const objetivo = notificaciones[0];

    if (objetivo) {
      await marcarNotificacionApi(page.request, token, objetivo.id, false);
      await page.reload();
    }

    try {
      const boton = page.getByRole("button", {
        name: "Marcar todas como leídas",
      });
      await expect(boton).toBeEnabled();
      await boton.click();

      await expect(
        page.getByText("Notificaciones marcadas como leídas."),
      ).toBeVisible();

      await campo(page, "Mostrar").selectOption("false");
      await expect(page.getByText("No tienes notificaciones")).toBeVisible();
    } finally {
      if (objetivo) {
        await marcarNotificacionApi(page.request, token, objetivo.id, false);
      }
    }
  });
});
