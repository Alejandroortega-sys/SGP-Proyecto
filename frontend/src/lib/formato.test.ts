import { describe, expect, it } from "vitest";
import {
  formatearFecha,
  formatearFechaHora,
  nombreCompleto,
  resumirValor,
  textoAccion,
  textoCategoria,
  textoPerfil,
  textoRol,
} from "@/lib/formato";

describe("formato", () => {
  it("formatea fechas y valores vacíos", () => {
    expect(formatearFecha(null)).toBe("—");
    expect(formatearFecha("no-es-fecha")).toBe("no-es-fecha");
    expect(formatearFecha("2026-09-15T14:30:00.000Z")).toContain("2026");
    expect(formatearFechaHora("2026-09-15T14:30:00.000Z")).toContain("2026");
  });

  it("traduce roles, perfiles y categorías", () => {
    expect(textoRol("comerciante")).toBe("Comerciante");
    expect(textoRol("organizador")).toBe("Organizador");
    expect(textoRol("gestor")).toBe("Gestor");
    expect(textoRol("otro")).toBe("otro");
    expect(textoPerfil("administrador")).toBe("Administrador");
    expect(textoPerfil("revisor")).toBe("Revisor");
    expect(textoPerfil(null)).toBe("—");
    expect(textoCategoria("formal")).toBe("Formal");
    expect(textoCategoria("informal")).toBe("Informal");
    expect(textoCategoria(null)).toBe("—");
  });

  it("traduce acciones de auditoría", () => {
    expect(textoAccion("insert")).toBe("Creación");
    expect(textoAccion("update")).toBe("Actualización");
    expect(textoAccion("delete")).toBe("Eliminación");
    expect(textoAccion("otra")).toBe("otra");
  });

  it("resume valores y compone nombres", () => {
    expect(resumirValor(null)).toBe("—");
    expect(resumirValor({ correo: "a@b.co" })).toContain("a@b.co");
    expect(resumirValor("x".repeat(200), 10)).toHaveLength(11);
    expect(nombreCompleto("María", "Gómez")).toBe("María Gómez");
    expect(nombreCompleto("María", null)).toBe("María");
  });
});
