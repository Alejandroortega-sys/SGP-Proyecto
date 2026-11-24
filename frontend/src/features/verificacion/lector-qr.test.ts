import { describe, expect, it } from "vitest";
import {
  esTokenValido,
  extraerTokenQr,
  normalizarToken,
} from "./lector-qr";

const TOKEN = "a3f0c44298fc1c149afbf4c8996fb92427ae41e4649b934c";

describe("lector de QR (HU-33)", () => {
  it("extrae el token de la URL de verificación completa", () => {
    expect(
      extraerTokenQr(`http://localhost:3001/verificar/${TOKEN}`),
    ).toBe(TOKEN);
    expect(
      extraerTokenQr(`https://sgp.tulua.gov.co/verificar/${TOKEN}`),
    ).toBe(TOKEN);
  });

  it("extrae el token de una ruta relativa y del token crudo", () => {
    expect(extraerTokenQr(`/verificar/${TOKEN}`)).toBe(TOKEN);
    expect(extraerTokenQr(TOKEN)).toBe(TOKEN);
    expect(extraerTokenQr(` ${TOKEN} `)).toBe(TOKEN);
  });

  it("rechaza contenido sin token", () => {
    expect(extraerTokenQr("")).toBeNull();
    expect(extraerTokenQr("   ")).toBeNull();
    expect(extraerTokenQr("http://localhost:3001/verificar/")).toBeNull();
    expect(extraerTokenQr("http://no-es-url")).toBeNull();
  });

  it("valida el formato de 48 caracteres hex del token de la BD", () => {
    expect(esTokenValido(TOKEN)).toBe(true);
    expect(esTokenValido(TOKEN.toUpperCase())).toBe(true);
    expect(esTokenValido("token-invalido")).toBe(false);
    expect(esTokenValido("a3f0")).toBe(false);
  });

  it("normaliza el token a minúsculas", () => {
    expect(normalizarToken(` ${TOKEN.toUpperCase()} `)).toBe(TOKEN);
  });
});
