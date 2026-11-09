import { describe, expect, it } from "vitest";
import type { GeometriaPunto } from "@/types/api";
import {
  construirSolicitudModulo,
  mismoPunto,
  requiereAceptacionEfectiva,
  validarArchivoFoto,
  validarValoresModulo,
  valoresInicialesModulo,
  type ValoresModulo,
} from "./validaciones-modulo";

const PUNTO: GeometriaPunto = {
  type: "Point",
  coordinates: [-76.1955, 4.0885],
};

const OTRO_PUNTO: GeometriaPunto = {
  type: "Point",
  coordinates: [-76.19, 4.09],
};

function valores(overrides: Partial<ValoresModulo> = {}): ValoresModulo {
  return {
    ...valoresInicialesModulo(),
    actividad: "Venta de empanadas",
    titularModo: "libre",
    titularNombre: "Nelson Mina",
    punto: PUNTO,
    ...overrides,
  };
}

describe("validación del censo de módulos", () => {
  it("acepta valores completos con titular libre", () => {
    const errores = validarValoresModulo(valores(), {
      requiereConfirmacion: false,
      aceptaAdvertencia: false,
    });

    expect(errores).toEqual({});
  });

  it("acepta un comerciante registrado como titular", () => {
    const errores = validarValoresModulo(
      valores({
        titularModo: "registrado",
        titularId: "4",
        titularNombre: "",
      }),
      { requiereConfirmacion: false, aceptaAdvertencia: false },
    );

    expect(errores).toEqual({});
  });

  it("exige punto, actividad y titular", () => {
    const errores = validarValoresModulo(
      valores({ punto: null, actividad: "", titularNombre: "" }),
      { requiereConfirmacion: false, aceptaAdvertencia: false },
    );

    expect(errores).toMatchObject({
      actividad: expect.any(String),
      titular: expect.any(String),
      punto: expect.any(String),
    });
  });

  it("valida el tipo y el tamaño de la foto", () => {
    expect(
      validarArchivoFoto({ name: "foto.txt", type: "text/plain", size: 10 }),
    ).toContain("JPG");
    expect(
      validarArchivoFoto({
        name: "foto.png",
        type: "image/png",
        size: 6 * 1024 * 1024,
      }),
    ).toContain("5 MB");
    expect(
      validarArchivoFoto({
        name: "foto.png",
        type: "image/png",
        size: 1024,
      }),
    ).toBeNull();
  });

  it("exige aceptación en una zona restringida al crear", () => {
    const errores = validarValoresModulo(valores(), {
      requiereConfirmacion: true,
      aceptaAdvertencia: false,
      esEdicion: false,
    });

    expect(errores.advertencia).toContain("confirmar");
  });

  it("no exige aceptación al editar un punto restringido sin moverlo", () => {
    expect(
      requiereAceptacionEfectiva(true, true, PUNTO, PUNTO),
    ).toBe(false);
    expect(
      requiereAceptacionEfectiva(true, true, PUNTO, OTRO_PUNTO),
    ).toBe(true);
    expect(requiereAceptacionEfectiva(true, false, null, PUNTO)).toBe(true);
  });

  it("compara puntos por coordenadas", () => {
    expect(mismoPunto(PUNTO, { ...PUNTO })).toBe(true);
    expect(mismoPunto(PUNTO, OTRO_PUNTO)).toBe(false);
    expect(mismoPunto(null, null)).toBe(true);
  });

  it("construye la solicitud con el titular y la aceptación", () => {
    expect(
      construirSolicitudModulo(
        valores({
          titularModo: "registrado",
          titularId: "4",
          titularNombre: "",
        }),
        true,
      ),
    ).toEqual({
      categoria: "informal",
      actividad: "Venta de empanadas",
      ubicacion: PUNTO,
      titularId: "4",
      aceptaAdvertencia: true,
    });

    const sinAceptacion = construirSolicitudModulo(valores(), false);
    expect(sinAceptacion).toMatchObject({
      titularNombre: "Nelson Mina",
    });
    expect(sinAceptacion).not.toHaveProperty("aceptaAdvertencia");
  });
});
