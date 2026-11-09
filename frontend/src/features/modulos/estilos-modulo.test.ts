import { describe, expect, it } from "vitest";
import {
  ETIQUETAS_CATEGORIA,
  ETIQUETAS_ESTADO_MODULO,
  formatearSector,
  nombreTitular,
  resumenZona,
  tieneConfirmacion,
} from "./estilos-modulo";

describe("textos del censo de módulos", () => {
  it("traduce categorías y estados", () => {
    expect(ETIQUETAS_CATEGORIA).toEqual({
      formal: "Formal",
      informal: "Informal",
    });
    expect(ETIQUETAS_ESTADO_MODULO).toEqual({
      activo: "Activo",
      baja: "Dado de baja",
    });
  });

  it("muestra el sector derivado o «Sin zona»", () => {
    expect(formatearSector("Centro - Calle 30")).toBe("Centro - Calle 30");
    expect(formatearSector(null)).toBe("Sin zona");
  });

  it("resuelve el nombre del titular registrado o libre", () => {
    expect(
      nombreTitular({
        titular: {
          id: "4",
          nombre: "José",
          apellido: "Pérez",
          correo: "jose@example.com",
        },
        titularNombre: null,
      }),
    ).toBe("José Pérez");

    expect(
      nombreTitular({
        titular: null,
        titularNombre: "Nelson Mina",
      }),
    ).toBe("Nelson Mina");
  });

  it("resume las restricciones de la zona", () => {
    expect(
      resumenZona({
        nombre: "Centro - Calle 30",
        tipo: "permitida",
        horarioInicio: "06:00",
        horarioFin: "18:00",
        aforoMaximo: 40,
        productos: ["Frutas frescas"],
      }),
    ).toContain("Centro - Calle 30");
    expect(resumenZona(null)).toContain("no está dentro");
  });

  it("detecta advertencias que requieren confirmación", () => {
    expect(
      tieneConfirmacion([
        {
          tipo: "zona_restringida",
          mensaje: "Restringida",
          requiereConfirmacion: true,
        },
      ]),
    ).toBe(true);
    expect(tieneConfirmacion([])).toBe(false);
  });
});
