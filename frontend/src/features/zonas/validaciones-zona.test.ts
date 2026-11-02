import { describe, expect, it } from "vitest";
import type { Producto, ZonaDetalle } from "@/types/api";
import type { Punto } from "./geometria-zona";
import {
  construirCuerpoActualizacion,
  construirCuerpoCreacion,
  validarValoresZona,
  valoresDesdeZona,
  valoresIniciales,
  type ValoresZona,
} from "./validaciones-zona";

const PRODUCTOS: Producto[] = [
  { id: "1", nombre: "Frutas frescas", activo: true },
  { id: "2", nombre: "Verduras", activo: true },
  { id: "3", nombre: "Plantas ornamentales", activo: false },
];

const PUNTOS: Punto[] = [
  [-76.202, 4.08],
  [-76.198, 4.08],
  [-76.198, 4.083],
  [-76.202, 4.083],
];

function valores(overrides: Partial<ValoresZona> = {}): ValoresZona {
  return {
    ...valoresIniciales(),
    nombre: "Parque La Guadua",
    ...overrides,
  };
}

const ZONA: ZonaDetalle = {
  id: "4",
  nombre: "Parque La Guadua",
  tipo: "permitida",
  horarioInicio: "08:00",
  horarioFin: "17:00",
  aforoMaximo: 25,
  activa: true,
  creadoPor: "1",
  creadoEn: "2026-09-15T14:30:00.000Z",
  actualizadoEn: "2026-09-15T14:30:00.000Z",
  geometria: {
    type: "Polygon",
    coordinates: [
      [
        [-76.202, 4.08],
        [-76.198, 4.08],
        [-76.198, 4.083],
        [-76.202, 4.083],
        [-76.202, 4.08],
      ],
    ],
  },
  productosPermitidos: [
    { id: "1", nombre: "Frutas frescas", activo: true },
    { id: "3", nombre: "Plantas ornamentales", activo: false },
  ],
};

describe("validación del formulario de zona", () => {
  it("acepta valores completos y válidos", () => {
    const errores = validarValoresZona(
      valores({
        horarioInicio: "08:00",
        horarioFin: "17:00",
        aforoMaximo: "25",
        productosPermitidos: ["1", "2"],
      }),
      PRODUCTOS,
    );

    expect(errores).toEqual({});
  });

  it("valida nombre, tipo, horario y aforo", () => {
    expect(
      validarValoresZona(valores({ nombre: "AB" }), PRODUCTOS).nombre,
    ).toBeDefined();
    expect(
      validarValoresZona(
        valores({ tipo: "otro" as ValoresZona["tipo"] }),
        PRODUCTOS,
      ).tipo,
    ).toBeDefined();
    expect(
      validarValoresZona(valores({ horarioInicio: "08:00" }), PRODUCTOS)
        .horario,
    ).toContain("juntos");
    expect(
      validarValoresZona(
        valores({ horarioInicio: "18:00", horarioFin: "08:00" }),
        PRODUCTOS,
      ).horario,
    ).toContain("posterior");
    expect(
      validarValoresZona(valores({ aforoMaximo: "0" }), PRODUCTOS).aforo,
    ).toBeDefined();
    expect(
      validarValoresZona(valores({ aforoMaximo: "2.5" }), PRODUCTOS).aforo,
    ).toBeDefined();
  });

  it("rechaza productos inactivos o repetidos", () => {
    expect(
      validarValoresZona(
        valores({ productosPermitidos: ["3"] }),
        PRODUCTOS,
      ).productos,
    ).toContain("no están activos");
    expect(
      validarValoresZona(
        valores({ productosPermitidos: ["1", "1"] }),
        PRODUCTOS,
      ).productos,
    ).toContain("repetir");
  });

  it("construye el cuerpo de creación con horario, aforo y productos", () => {
    const cuerpo = construirCuerpoCreacion(
      valores({
        horarioInicio: "08:00",
        horarioFin: "17:00",
        aforoMaximo: "25",
        productosPermitidos: ["1", "2"],
      }),
      PUNTOS,
    );

    expect(cuerpo).toMatchObject({
      nombre: "Parque La Guadua",
      tipo: "permitida",
      horarioInicio: "08:00",
      horarioFin: "17:00",
      aforoMaximo: 25,
      productosPermitidos: ["1", "2"],
    });
    expect(cuerpo.geometria.coordinates[0]).toHaveLength(5);
  });

  it("omite horario y aforo cuando están vacíos", () => {
    const cuerpo = construirCuerpoCreacion(valores(), PUNTOS);

    expect(cuerpo.horarioInicio).toBeUndefined();
    expect(cuerpo.horarioFin).toBeUndefined();
    expect(cuerpo.aforoMaximo).toBeUndefined();
  });

  it("conserva solo productos activos al editar una zona", () => {
    const iniciales = valoresDesdeZona(ZONA);

    expect(iniciales.productosPermitidos).toEqual(["1"]);
    expect(iniciales.horarioInicio).toBe("08:00");
    expect(iniciales.aforoMaximo).toBe("25");
  });

  it("envía solo los campos modificados y permite borrar restricciones", () => {
    const iniciales = valoresDesdeZona(ZONA);
    const actuales: ValoresZona = {
      ...iniciales,
      nombre: "Parque renovado",
      horarioInicio: "",
      horarioFin: "",
      aforoMaximo: "",
      productosPermitidos: ["2"],
    };

    const cambios = construirCuerpoActualizacion(
      actuales,
      iniciales,
      PUNTOS,
      true,
    );

    expect(cambios).toMatchObject({
      nombre: "Parque renovado",
      horarioInicio: null,
      horarioFin: null,
      aforoMaximo: null,
      productosPermitidos: ["2"],
    });
    expect(cambios.geometria).toBeDefined();
  });

  it("no envía nada si no hay cambios", () => {
    const iniciales = valoresDesdeZona(ZONA);
    const cambios = construirCuerpoActualizacion(
      iniciales,
      iniciales,
      PUNTOS,
      false,
    );

    expect(cambios).toEqual({});
  });
});
