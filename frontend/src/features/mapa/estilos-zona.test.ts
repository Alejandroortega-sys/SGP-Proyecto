import { describe, expect, it } from "vitest";
import {
  CENTRO_TULUA,
  construirDetalleZona,
  distanciaKm,
  esTipoZona,
  estiloZona,
  estaEnTulua,
  formatearAforo,
  formatearHorario,
  formatearProductos,
} from "./estilos-zona";
import type { ZonaGeoJsonProperties } from "@/types/api";

const ZONA: ZonaGeoJsonProperties = {
  id: "1",
  nombre: "Centro - Calle 30",
  tipo: "permitida",
  horarios: { inicio: "06:00", fin: "18:00" },
  aforo: 40,
  productos: ["Frutas frescas", "Verduras"],
};

describe("estilos de zona", () => {
  it("asigna color y patrón distintos a cada tipo", () => {
    const permitida = estiloZona("permitida");
    const restringida = estiloZona("restringida");
    const congestion = estiloZona("alta_congestion");

    expect(permitida.color).not.toBe(restringida.color);
    expect(restringida.color).not.toBe(congestion.color);
    expect(permitida.dashArray).toBeUndefined();
    expect(restringida.dashArray).toBeDefined();
    expect(congestion.dashArray).toBeDefined();
  });

  it("reconoce solo los tipos válidos", () => {
    expect(esTipoZona("permitida")).toBe(true);
    expect(esTipoZona("alta_congestion")).toBe(true);
    expect(esTipoZona("otra")).toBe(false);
    expect(esTipoZona(null)).toBe(false);
  });
});

describe("formato del detalle", () => {
  it("formatea horarios completos, parciales y vacíos", () => {
    expect(formatearHorario({ inicio: "06:00", fin: "18:00" })).toBe(
      "06:00 a 18:00",
    );
    expect(formatearHorario({ inicio: "06:00", fin: null })).toBe(
      "Desde 06:00",
    );
    expect(formatearHorario({ inicio: null, fin: "18:00" })).toBe(
      "Hasta 18:00",
    );
    expect(formatearHorario({ inicio: null, fin: null })).toBe(
      "Sin horario definido",
    );
  });

  it("formatea aforo y productos", () => {
    expect(formatearAforo(40)).toBe("40 personas");
    expect(formatearAforo(1)).toBe("1 persona");
    expect(formatearAforo(null)).toBe("Sin aforo definido");
    expect(formatearProductos(["Frutas", "Verduras"])).toBe(
      "Frutas, Verduras",
    );
    expect(formatearProductos([])).toBe("Sin productos restringidos");
  });

  it("construye el detalle completo del popup", () => {
    expect(construirDetalleZona(ZONA)).toEqual({
      tipo: "Permitida",
      horario: "06:00 a 18:00",
      aforo: "40 personas",
      productos: "Frutas frescas, Verduras",
    });
  });
});

describe("geolocalización", () => {
  it("calcula distancias aproximadas", () => {
    expect(
      distanciaKm(
        CENTRO_TULUA.lat,
        CENTRO_TULUA.lng,
        CENTRO_TULUA.lat,
        CENTRO_TULUA.lng,
      ),
    ).toBe(0);

    const unKilometro = distanciaKm(
      CENTRO_TULUA.lat,
      CENTRO_TULUA.lng,
      CENTRO_TULUA.lat + 0.009,
      CENTRO_TULUA.lng,
    );
    expect(unKilometro).toBeGreaterThan(0.9);
    expect(unKilometro).toBeLessThan(1.1);
  });

  it("distingue coordenadas dentro y fuera de Tuluá", () => {
    expect(estaEnTulua(CENTRO_TULUA.lat, CENTRO_TULUA.lng)).toBe(true);
    expect(estaEnTulua(4.15, -76.25)).toBe(true);
    expect(estaEnTulua(4.6, -74.1)).toBe(false);
  });
});
