import { describe, expect, it } from "vitest";
import {
  COLORES_ESTADO_ESPACIO,
  ETIQUETAS_ESTADO_ESPACIO,
  ETIQUETAS_TIPO_ESPACIO,
  formatearDimensiones,
  formatearEstadoEspacio,
  formatearHorarioEspacio,
  formatearProductos,
  formatearRangoFechas,
  formatearTipoEspacio,
  SIMBOLOS_ESTADO_ESPACIO,
} from "./estilos-espacio";

describe("estilos y textos de espacios", () => {
  it("asigna un color y un símbolo distinto a cada estado", () => {
    const colores = Object.values(COLORES_ESTADO_ESPACIO);
    const simbolos = Object.values(SIMBOLOS_ESTADO_ESPACIO);

    expect(new Set(colores).size).toBe(colores.length);
    expect(new Set(simbolos).size).toBe(simbolos.length);
    expect(ETIQUETAS_ESTADO_ESPACIO.asignado).toBe("Ocupado");
  });

  it("traduce los tipos de espacio", () => {
    expect(formatearTipoEspacio("modulo")).toBe("Módulo");
    expect(formatearTipoEspacio("kiosco")).toBe("Kiosco");
    expect(formatearTipoEspacio("puesto")).toBe("Puesto");
    expect(formatearTipoEspacio("espacio_movil")).toBe("Espacio móvil");
    expect(Object.keys(ETIQUETAS_TIPO_ESPACIO)).toHaveLength(4);
  });

  it("traduce los estados de espacio", () => {
    expect(formatearEstadoEspacio("disponible")).toBe("Disponible");
    expect(formatearEstadoEspacio("bloqueado")).toBe("Bloqueado");
    expect(formatearEstadoEspacio("asignado")).toBe("Ocupado");
    expect(formatearEstadoEspacio("mantenimiento")).toBe(
      "En mantenimiento",
    );
  });

  it("formatea horarios completos, parciales y vacíos", () => {
    expect(
      formatearHorarioEspacio({ inicio: "06:00", fin: "14:00" }),
    ).toBe("06:00 a 14:00");
    expect(formatearHorarioEspacio({ inicio: "06:00", fin: null })).toBe(
      "Desde 06:00",
    );
    expect(formatearHorarioEspacio({ inicio: null, fin: "14:00" })).toBe(
      "Hasta 14:00",
    );
    expect(formatearHorarioEspacio({ inicio: null, fin: null })).toBe(
      "Sin horario definido",
    );
  });

  it("formatea dimensiones, productos y rangos de fechas", () => {
    expect(formatearDimensiones("3 × 2 m")).toBe("3 × 2 m");
    expect(formatearDimensiones(null)).toBe("Sin dimensiones registradas");
    expect(formatearProductos(["Frutas", "Verduras"])).toBe(
      "Frutas, Verduras",
    );
    expect(formatearProductos([])).toBe("Sin productos restringidos");
    expect(formatearRangoFechas("2026-10-25", "2026-10-31")).toBe(
      "del 25/10/2026 al 31/10/2026",
    );
    expect(formatearRangoFechas(null, null)).toBe("Sin fechas registradas");
  });
});
