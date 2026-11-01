import { describe, expect, it } from "vitest";
import {
  contarFiltrosActivos,
  FILTROS_FORMULARIO_VACIOS,
  filtrosParaApi,
  formatearRangoHorario,
  hayFiltrosActivos,
  tieneErrores,
  validarFiltros,
} from "./filtros-espacios";

describe("filtros de espacios", () => {
  it("cuenta los filtros activos sin contar el toggle de no disponibles", () => {
    expect(contarFiltrosActivos(FILTROS_FORMULARIO_VACIOS)).toBe(0);
    expect(hayFiltrosActivos(FILTROS_FORMULARIO_VACIOS)).toBe(false);

    const filtros = {
      sector: "Centro",
      actividad: "Artesanías",
      fecha: "2026-11-10",
      horaInicio: "10:00",
      horaFin: "12:00",
    };

    expect(contarFiltrosActivos(filtros)).toBe(4);
    expect(hayFiltrosActivos(filtros)).toBe(true);
  });

  it("valida que las horas se envíen juntas", () => {
    const errores = validarFiltros({
      ...FILTROS_FORMULARIO_VACIOS,
      fecha: "2026-11-10",
      horaInicio: "10:00",
    });

    expect(tieneErrores(errores)).toBe(true);
    expect(errores.horario).toContain("Completa");
  });

  it("exige fecha cuando se filtra por horario", () => {
    const errores = validarFiltros({
      ...FILTROS_FORMULARIO_VACIOS,
      horaInicio: "10:00",
      horaFin: "12:00",
    });

    expect(errores.fecha).toContain("fecha");
  });

  it("valida que la hora de fin sea posterior a la de inicio", () => {
    const errores = validarFiltros({
      ...FILTROS_FORMULARIO_VACIOS,
      fecha: "2026-11-10",
      horaInicio: "12:00",
      horaFin: "10:00",
    });

    expect(errores.horario).toContain("posterior");
  });

  it("acepta un rango horario válido", () => {
    const errores = validarFiltros({
      ...FILTROS_FORMULARIO_VACIOS,
      fecha: "2026-11-10",
      horaInicio: "10:00",
      horaFin: "12:00",
    });

    expect(tieneErrores(errores)).toBe(false);
  });

  it("convierte el formulario al contrato de la API", () => {
    const filtros = {
      sector: "  Centro ",
      actividad: " Artesanías ",
      fecha: "2026-11-10",
      horaInicio: "10:00",
      horaFin: "12:00",
    };

    expect(filtrosParaApi(filtros, true)).toEqual({
      incluirNoDisponibles: true,
      sector: "Centro",
      actividad: "Artesanías",
      fecha: "2026-11-10",
      horaInicio: "10:00",
      horaFin: "12:00",
    });
  });

  it("formatea el rango horario", () => {
    expect(formatearRangoHorario("10:00", "12:00")).toBe("10:00 a 12:00");
    expect(formatearRangoHorario("", "")).toBe("");
  });
});
