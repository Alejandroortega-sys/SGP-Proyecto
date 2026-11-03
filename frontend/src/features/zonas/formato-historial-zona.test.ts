import { describe, expect, it } from "vitest";
import {
  describirCambio,
  formatearArea,
  formatearValorCambio,
  textoAccionVersion,
} from "./formato-historial-zona";

describe("historial de zonas (formato)", () => {
  it("traduce las acciones de una versión", () => {
    expect(textoAccionVersion("creacion")).toBe("Zona creada");
    expect(textoAccionVersion("edicion")).toBe("Zona editada");
    expect(textoAccionVersion("activacion")).toBe("Zona activada");
    expect(textoAccionVersion("desactivacion")).toBe("Zona desactivada");
  });

  it("formatea el área en metros cuadrados", () => {
    expect(formatearArea(151500.4)).toMatch(/151\.500 m²/);
    expect(formatearArea(null)).toBe("sin área");
  });

  it("formatea los campos versionados", () => {
    expect(formatearValorCambio("tipo", "alta_congestion")).toBe(
      "Alta congestión",
    );
    expect(
      formatearValorCambio("horario", { inicio: "06:00", fin: "18:00" }),
    ).toBe("06:00 a 18:00");
    expect(formatearValorCambio("aforoMaximo", 40)).toContain("40");
    expect(formatearValorCambio("activa", false)).toBe("Inactiva");
    expect(
      formatearValorCambio("productosPermitidos", [
        "Frutas frescas",
        "Verduras",
      ]),
    ).toBe("Frutas frescas, Verduras");
    expect(
      formatearValorCambio("productosPermitidos", []),
    ).toBe("Sin productos permitidos");
    expect(
      formatearValorCambio("geometria", { vertices: 5, areaM2: 151500 }),
    ).toMatch(/5 vértices · 151\.500 m²/);
  });

  it("describe un cambio para la línea de tiempo", () => {
    expect(
      describirCambio({
        campo: "aforoMaximo",
        etiqueta: "Aforo máximo",
        anterior: 40,
        nuevo: 30,
      }),
    ).toMatch(/^Aforo máximo: .*40.* → .*30/);
  });
});
