import { describe, expect, it } from "vitest";
import type { ZonaFeria } from "@/types/api";
import {
  FORMULARIO_FERIA_VACIO,
  hoyISO,
  sinErrores,
  validarFormularioFeria,
  type ValoresFeria,
} from "./validaciones-feria";

const ZONA: ZonaFeria = {
  id: "4",
  nombre: "Parque La Guadua",
  tipo: "permitida",
  activa: true,
  aforoMaximo: 25,
  horarioInicio: "06:00",
  horarioFin: "20:00",
  productosPermitidos: ["Frutas frescas"],
  admiteFerias: true,
};

function fechaFutura(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const VALORES: ValoresFeria = {
  nombre: "Feria Agroecológica",
  tipoFeria: "Feria agroecológica",
  zonaId: "4",
  fechaInicio: fechaFutura(7),
  fechaFin: fechaFutura(9),
  numeroPuestos: "20",
  productoIds: ["1"],
};

describe("validaciones de feria", () => {
  it("acepta un formulario completo dentro del aforo", () => {
    expect(validarFormularioFeria(VALORES, ZONA)).toEqual({});
    expect(sinErrores(validarFormularioFeria(VALORES, ZONA))).toBe(true);
  });

  it("exige nombre, tipo, zona, fechas y productos", () => {
    const errores = validarFormularioFeria(FORMULARIO_FERIA_VACIO, null);
    expect(errores.nombre).toBeTruthy();
    expect(errores.tipoFeria).toBeTruthy();
    expect(errores.zonaId).toBeTruthy();
    expect(errores.fechaInicio).toBeTruthy();
    expect(errores.fechaFin).toBeTruthy();
    expect(errores.numeroPuestos).toBeTruthy();
    expect(errores.productoIds).toBeTruthy();
  });

  it("rechaza una fecha de inicio anterior a hoy", () => {
    const errores = validarFormularioFeria(
      { ...VALORES, fechaInicio: "2000-01-01", fechaFin: "2000-01-02" },
      ZONA,
    );
    expect(errores.fechaInicio).toContain("anterior a hoy");
  });

  it("rechaza una fecha de fin anterior a la de inicio", () => {
    const errores = validarFormularioFeria(
      { ...VALORES, fechaFin: fechaFutura(1) },
      ZONA,
    );
    expect(errores.fechaFin).toContain("igual o posterior");
  });

  it("rechaza superar el aforo de la zona", () => {
    const errores = validarFormularioFeria(
      { ...VALORES, numeroPuestos: "26" },
      ZONA,
    );
    expect(errores.numeroPuestos).toContain("máximo 25");
  });

  it("rechaza una zona sin aforo definido", () => {
    const errores = validarFormularioFeria(VALORES, {
      ...ZONA,
      aforoMaximo: null,
      admiteFerias: false,
    });
    expect(errores.zonaId).toContain("no tiene aforo");
  });

  it("rechaza cantidades no enteras o no positivas", () => {
    expect(
      validarFormularioFeria({ ...VALORES, numeroPuestos: "0" }, ZONA)
        .numeroPuestos,
    ).toBeTruthy();
    expect(
      validarFormularioFeria({ ...VALORES, numeroPuestos: "2.5" }, ZONA)
        .numeroPuestos,
    ).toBeTruthy();
  });

  it("calcula la fecha de hoy en formato ISO", () => {
    expect(hoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
