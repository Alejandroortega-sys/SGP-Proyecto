import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API_URL = "http://localhost:3000";

export const CREDENCIALES = {
  administrador: { correo: "admin@tulua.gov.co", password: "Admin1234" },
  revisor: { correo: "revisor@tulua.gov.co", password: "Admin1234" },
  comerciante: { correo: "maria.gomez@gmail.com", password: "Comerciante123" },
  organizador: {
    correo: "luis.alvarez@agrovalle.org",
    password: "Organizador123",
  },
} as const;

/**
 * Localiza un campo por el inicio de su etiqueta. Los campos obligatorios
 * añaden un asterisco al texto de la etiqueta, por eso no se usa `exact`.
 */
export function campo(page: Page, texto: string) {
  const escapado = texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.getByLabel(new RegExp(`^${escapado}`));
}

export async function iniciarSesion(
  page: Page,
  correo: string,
  password: string,
  rutaEsperada: string,
): Promise<void> {
  await page.goto("/login");
  await campo(page, "Correo electrónico").fill(correo);
  await campo(page, "Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar Sesión" }).click();
  await page.waitForURL(`**${rutaEsperada}`);
  await page.waitForLoadState("networkidle");
}

export async function cerrarSesion(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.waitForURL("**/login");
}

export async function tokenSesion(page: Page): Promise<string> {
  const token = await page.evaluate(() =>
    window.sessionStorage.getItem("sgp.accessToken"),
  );
  if (!token) throw new Error("No hay access token en sessionStorage.");
  return token;
}

export function cabecerasApi(token: string): {
  headers: Record<string, string>;
} {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function obtenerNotificaciones(
  request: APIRequestContext,
  token: string,
  soloNoLeidas = false,
): Promise<Array<{ id: string; leida: boolean }>> {
  const url = `${API_URL}/notificaciones?limite=5${soloNoLeidas ? "&leida=false" : ""}`;
  const respuesta = await request.get(url, cabecerasApi(token));
  expect(respuesta.ok()).toBeTruthy();
  const cuerpo = (await respuesta.json()) as {
    datos: Array<{ id: string; leida: boolean }>;
  };
  return cuerpo.datos;
}

export async function marcarNotificacionApi(
  request: APIRequestContext,
  token: string,
  id: string,
  leida: boolean,
): Promise<void> {
  const respuesta = await request.patch(
    `${API_URL}/notificaciones/${id}/leida`,
    {
      ...cabecerasApi(token),
      data: { leida },
    },
  );
  expect(respuesta.ok()).toBeTruthy();
}
