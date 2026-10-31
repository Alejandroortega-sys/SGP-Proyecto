import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de usabilidad de la interfaz con Playwright.
 *
 * Usa Microsoft Edge ya instalado (`channel: "msedge"`) para no descargar
 * navegadores adicionales. Levanta la API en 3000 y el frontend en 3001.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 40_000,
  },
  projects: [
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
  ],
  webServer: [
    {
      command: "pnpm start",
      cwd: "..",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 240_000,
      stdout: "pipe",
      stderr: "pipe",
      // Las pruebas inician sesión muchas veces seguidas desde la misma IP.
      env: { LOGIN_RATE_LIMIT_MAX: "200" },
    },
    {
      command: "pnpm build && pnpm start",
      cwd: ".",
      url: "http://localhost:3001",
      reuseExistingServer: true,
      timeout: 240_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
