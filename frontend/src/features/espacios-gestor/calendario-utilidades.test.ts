import { describe, expect, it } from "vitest";
import type { BloqueoEspacioGestor } from "@/types/api";
import {
  bloqueosDelDia,
  desplazarMes,
  diasDelMes,
  estaEnRango,
  generarCuadricula,
  nombreMes,
} from "./calendario-utilidades";

const BLOQUEO: BloqueoEspacioGestor = {
  id: "1",
  fechaInicio: "2026-12-20",
  fechaFin: "2026-12-24",
  motivo: "Evento",
  activo: false,
  creadoPorId: "1",
  creadoPorNombre: "Laura",
  creadoEn: "2026-11-11T10:00:00.000Z",
};

describe("calendario de bloqueos", () => {
  it("desplaza meses entre años", () => {
    expect(desplazarMes({ anio: 2026, mes: 1 }, -1)).toEqual({
      anio: 2025,
      mes: 12,
    });
    expect(desplazarMes({ anio: 2026, mes: 12 }, 1)).toEqual({
      anio: 2027,
      mes: 1,
    });
  });

  it("calcula los días del mes y el nombre", () => {
    expect(diasDelMes(2026, 2)).toBe(28);
    expect(diasDelMes(2028, 2)).toBe(29);
    expect(nombreMes({ anio: 2026, mes: 12 })).toBe("Diciembre 2026");
  });

  it("genera 42 celdas que empiezan en lunes", () => {
    const celdas = generarCuadricula({ anio: 2026, mes: 12 });

    expect(celdas).toHaveLength(42);
    expect(celdas[0].fecha).toBe("2026-11-30");
    expect(celdas[0].delMes).toBe(false);
    expect(celdas[2].fecha).toBe("2026-12-02");
    expect(celdas[2].delMes).toBe(true);
  });

  it("detecta si una fecha está dentro del rango inclusivo", () => {
    expect(estaEnRango("2026-12-20", "2026-12-20", "2026-12-24")).toBe(true);
    expect(estaEnRango("2026-12-24", "2026-12-20", "2026-12-24")).toBe(true);
    expect(estaEnRango("2026-12-25", "2026-12-20", "2026-12-24")).toBe(false);
  });

  it("encuentra los bloqueos de un día", () => {
    expect(bloqueosDelDia("2026-12-22", [BLOQUEO])).toHaveLength(1);
    expect(bloqueosDelDia("2026-12-26", [BLOQUEO])).toHaveLength(0);
  });
});
