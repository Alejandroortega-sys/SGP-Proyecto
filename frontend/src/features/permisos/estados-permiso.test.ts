import { describe, expect, it } from "vitest";
import {
  DIAS_AVISO_RENOVACION,
  DESTINOS_PERMITIDOS,
  destinoExigeMotivo,
  diasParaVencer,
  esEstadoPermiso,
  formatearValorCobro,
  puedeRenovar,
  vencePronto,
} from "./estados-permiso";

function fechaEnDias(dias: number): string {
  const base = new Date(2026, 10, 23); // 23 de noviembre de 2026
  const fecha = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

const HOY = new Date(2026, 10, 23);

describe("estados de permiso (Sprint 5)", () => {
  it("valida los estados del permiso", () => {
    expect(esEstadoPermiso("vigente")).toBe(true);
    expect(esEstadoPermiso("anulado")).toBe(false);
    expect(esEstadoPermiso(42)).toBe(false);
  });

  it("HU-35: suspendido y revocado exigen motivo; reactivar no", () => {
    expect(destinoExigeMotivo("suspendido")).toBe(true);
    expect(destinoExigeMotivo("revocado")).toBe(true);
    expect(destinoExigeMotivo("vigente")).toBe(false);
  });

  it("HU-35: las transiciones finales no ofrecen destinos", () => {
    expect(DESTINOS_PERMITIDOS.revocado).toEqual([]);
    expect(DESTINOS_PERMITIDOS.vencido).toEqual([]);
    expect(DESTINOS_PERMITIDOS.vigente).toContain("suspendido");
    // Un permiso suspendido se puede reactivar (CA2) o revocar.
    expect(DESTINOS_PERMITIDOS.suspendido).toContain("vigente");
    expect(DESTINOS_PERMITIDOS.suspendido).toContain("revocado");
  });

  it("HU-34: cuenta los días para vencer", () => {
    expect(diasParaVencer(fechaEnDias(15), HOY)).toBe(15);
    expect(diasParaVencer(fechaEnDias(0), HOY)).toBe(0);
    expect(diasParaVencer(fechaEnDias(-1), HOY)).toBe(-1);
    expect(diasParaVencer("fecha-invalida", HOY)).toBeNaN();
  });

  it("HU-34-CA1: el aviso aparece solo si vence pronto y está vigente", () => {
    expect(vencePronto("vigente", fechaEnDias(15), HOY)).toBe(true);
    expect(vencePronto("vigente", fechaEnDias(16), HOY)).toBe(false);
    expect(vencePronto("vigente", fechaEnDias(-1), HOY)).toBe(false);
    expect(vencePronto("suspendido", fechaEnDias(3), HOY)).toBe(false);
    expect(DIAS_AVISO_RENOVACION).toBe(15);
  });

  it("HU-34-CA4: un permiso vencido no se puede renovar", () => {
    expect(puedeRenovar("vigente", fechaEnDias(14), HOY)).toBe(true);
    expect(puedeRenovar("vigente", fechaEnDias(-1), HOY)).toBe(false);
    expect(puedeRenovar("suspendido", fechaEnDias(14), HOY)).toBe(false);
    expect(puedeRenovar("revocado", fechaEnDias(14), HOY)).toBe(false);
  });

  it("HU-36: formatea el valor del cobro como pesos colombianos", () => {
    expect(formatearValorCobro("50000")).toContain("50.000");
    expect(formatearValorCobro("50000")).toContain("$");
    expect(formatearValorCobro("no-numero")).toBe("$ no-numero");
  });
});
