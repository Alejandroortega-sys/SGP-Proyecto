import { describe, expect, it } from "vitest";
import type { CupoParticipantes, ProductoFeria } from "@/types/api";
import {
  calcularCupo,
  FORMULARIO_PARTICIPANTE_VACIO,
  puedeEnviarListado,
  sinErroresParticipante,
  validarFormularioParticipante,
  type ValoresParticipante,
} from "./validaciones-participantes";

const CATALOGO: ProductoFeria[] = [
  { id: "1", nombre: "Frutas frescas" },
  { id: "2", nombre: "Verduras" },
];

const CUPO: CupoParticipantes = {
  aprobado: 2,
  ocupados: 0,
  disponibles: 2,
  completo: false,
};

const VALORES: ValoresParticipante = {
  nombre: "Doralice Lozano",
  documento: "CC 43789123",
  productoIds: ["1"],
};

const CONTEXTO = {
  catalogo: CATALOGO,
  productosPermitidos: ["Frutas frescas", "Verduras"],
  cupo: CUPO,
  esEdicion: false,
};

describe("validaciones de participantes", () => {
  it("acepta un formulario completo", () => {
    expect(validarFormularioParticipante(VALORES, CONTEXTO)).toEqual({});
    expect(sinErroresParticipante(validarFormularioParticipante(VALORES, CONTEXTO))).toBe(
      true,
    );
  });

  it("exige nombre y al menos un producto", () => {
    const errores = validarFormularioParticipante(
      FORMULARIO_PARTICIPANTE_VACIO,
      CONTEXTO,
    );
    expect(errores.nombre).toBeTruthy();
    expect(errores.productoIds).toBeTruthy();
  });

  it("valida la longitud del documento cuando se informa", () => {
    expect(
      validarFormularioParticipante({ ...VALORES, documento: "12" }, CONTEXTO)
        .documento,
    ).toBeTruthy();
    expect(
      validarFormularioParticipante({ ...VALORES, documento: "" }, CONTEXTO)
        .documento,
    ).toBeUndefined();
  });

  it("rechaza productos fuera del catálogo", () => {
    const errores = validarFormularioParticipante(
      { ...VALORES, productoIds: ["99"] },
      CONTEXTO,
    );
    expect(errores.productoIds).toContain("no son válidos");
  });

  it("rechaza productos no permitidos en la zona", () => {
    const errores = validarFormularioParticipante(
      { ...VALORES, productoIds: ["2"] },
      { ...CONTEXTO, productosPermitidos: ["Frutas frescas"] },
    );
    expect(errores.productoIds).toContain("no están permitidos");
  });

  it("bloquea el alta cuando el cupo está completo", () => {
    const errores = validarFormularioParticipante(VALORES, {
      ...CONTEXTO,
      cupo: calcularCupo(2, 2),
    });
    expect(errores.general).toContain("cupo aprobado");
  });

  it("permite editar aunque el cupo esté completo", () => {
    const errores = validarFormularioParticipante(VALORES, {
      ...CONTEXTO,
      cupo: calcularCupo(2, 2),
      esEdicion: true,
    });
    expect(errores.general).toBeUndefined();
  });

  it("calcula el cupo disponible", () => {
    expect(calcularCupo(5, 3)).toEqual({
      aprobado: 5,
      ocupados: 3,
      disponibles: 2,
      completo: false,
    });
    expect(calcularCupo(2, 3)).toEqual({
      aprobado: 2,
      ocupados: 3,
      disponibles: 0,
      completo: true,
    });
  });

  it("solo permite enviar con participantes y sin envío previo", () => {
    expect(puedeEnviarListado(false, 1)).toBe(true);
    expect(puedeEnviarListado(false, 0)).toBe(false);
    expect(puedeEnviarListado(true, 3)).toBe(false);
  });
});
