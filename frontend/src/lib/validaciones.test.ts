import { describe, expect, it } from "vitest";
import {
  CODIGO_6_RE,
  NIT_RE,
  evaluarFortalezaPassword,
  validarActividadComercial,
  validarApellido,
  validarCodigo6,
  validarCoincidencia,
  validarCorreo,
  validarDocumento,
  validarNombre,
  validarPassword,
  validarTelefono,
} from "@/lib/validaciones";

describe("validaciones espejo del backend", () => {
  it("valida nombres y apellidos", () => {
    expect(validarNombre("María")).toBeNull();
    expect(validarNombre("A")).toContain("2 caracteres");
    expect(validarNombre("a".repeat(151))).toContain("150");
    expect(validarApellido("")).toBeNull();
    expect(validarApellido("Gómez")).toBeNull();
  });

  it("valida correos", () => {
    expect(validarCorreo("maria.gomez@gmail.com")).toBeNull();
    expect(validarCorreo("")).toContain("obligatorio");
    expect(validarCorreo("sin-arroba")).toContain("válido");
    expect(validarCorreo(`${"a".repeat(150)}@x.co`)).toContain("150");
  });

  it("valida teléfonos colombianos", () => {
    expect(validarTelefono("3214567890")).toBeNull();
    expect(validarTelefono("+57 321 456 7890")).toBeNull();
    expect(validarTelefono("abc")).toContain("válido");
    expect(validarTelefono("")).toContain("obligatorio");
  });

  it("valida documentos", () => {
    expect(validarDocumento("1032456789")).toBeNull();
    expect(validarDocumento("ABC-123")).toBeNull();
    expect(validarDocumento("12")).toContain("5 a 30");
    expect(validarDocumento("")).toContain("obligatorio");
  });

  it("valida la política de contraseñas", () => {
    expect(validarPassword("Comerciante123")).toBeNull();
    expect(validarPassword("corta")).toContain("8 caracteres");
    expect(validarPassword("sinNumeros")).toContain("número");
    expect(validarPassword("a".repeat(129))).toContain("128");
  });

  it("valida coincidencia y actividad comercial", () => {
    expect(validarCoincidencia("Clave123", "Clave123")).toBeNull();
    expect(validarCoincidencia("Clave123", "Otra123")).toContain("no coinciden");
    expect(validarActividadComercial("Venta de frutas")).toBeNull();
    expect(validarActividadComercial("ab")).toContain("3 caracteres");
  });

  it("valida códigos de 6 dígitos y NIT", () => {
    expect(CODIGO_6_RE.test("123456")).toBe(true);
    expect(validarCodigo6("12345")).toContain("6 dígitos");
    expect(NIT_RE.test("900123456-1")).toBe(true);
    expect(NIT_RE.test("90012345")).toBe(true);
    expect(NIT_RE.test("1234567")).toBe(false);
  });

  it("calcula la fortaleza de la contraseña", () => {
    expect(evaluarFortalezaPassword("123").nivel).toBe(0);
    expect(evaluarFortalezaPassword("Clave1234").nivel).toBeGreaterThanOrEqual(2);
    expect(evaluarFortalezaPassword("Clave1234!Segura").nivel).toBe(4);
  });
});
