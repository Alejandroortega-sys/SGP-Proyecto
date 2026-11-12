import { describe, expect, it } from "vitest";
import type { GeometriaPunto } from "@/types/api";
import {
  construirSolicitudEspacio,
  espacioDesdeDetalle,
  validarRangoBloqueo,
  validarValoresEspacio,
  valoresInicialesEspacio,
  type ValoresEspacio,
} from "./validaciones-espacio";

const PUNTO: GeometriaPunto = {
  type: "Point",
  coordinates: [-76.1908, 4.0885],
};

function valores(overrides: Partial<ValoresEspacio> = {}): ValoresEspacio {
  return {
    ...valoresInicialesEspacio(),
    nombre: "Puesto Plaza Boyacá - Occidente",
    sector: "Plaza Boyacá",
    dimensiones: "4 × 3 m",
    actividadPermitida: "Comidas rápidas",
    horarioInicio: "07:00",
    horarioFin: "17:00",
    punto: PUNTO,
    ...overrides,
  };
}

describe("validación del espacio temporal", () => {
  it("acepta un formulario completo", () => {
    expect(validarValoresEspacio(valores())).toEqual({});
  });

  it("exige nombre, tipo y ubicación", () => {
    const errores = validarValoresEspacio(
      valores({ nombre: "", tipo: "", punto: null }),
    );

    expect(errores.nombre).toBeDefined();
    expect(errores.tipo).toBeDefined();
    expect(errores.punto).toBeDefined();
  });

  it("rechaza un horario incompleto o invertido", () => {
    expect(
      validarValoresEspacio(valores({ horarioFin: "" })).horario,
    ).toBeDefined();
    expect(
      validarValoresEspacio(
        valores({ horarioInicio: "18:00", horarioFin: "08:00" }),
      ).horario,
    ).toBeDefined();
  });

  it("construye la solicitud con campos opcionales vacíos como null", () => {
    const solicitud = construirSolicitudEspacio(
      valores({ sector: "", dimensiones: "", actividadPermitida: "" }),
    );

    expect(solicitud).toMatchObject({
      nombre: "Puesto Plaza Boyacá - Occidente",
      tipo: "puesto",
      sector: null,
      dimensiones: null,
      actividadPermitida: null,
      horarioInicio: "07:00",
      horarioFin: "17:00",
      estado: "disponible",
    });
  });

  it("convierte la ficha administrativa al formulario", () => {
    const valoresFormulario = espacioDesdeDetalle({
      id: "7",
      nombre: "Puesto",
      tipo: "puesto",
      sector: "Plaza Boyacá",
      dimensiones: "4 × 3 m",
      actividadPermitida: "Comidas rápidas",
      estado: "asignado",
      estadoEfectivo: "asignado",
      disponible: false,
      motivoEstado: null,
      asignacionManual: true,
      ubicacion: PUNTO,
      horario: { inicio: "07:00", fin: "17:00" },
      horarioPropio: { inicio: null, fin: null },
      zona: null,
      totalBloqueos: 0,
      tienePermisos: false,
      tieneSolicitudes: false,
      creadoEn: "2026-11-11T10:00:00.000Z",
      bloqueos: [],
      puedeEliminar: true,
      creadoPor: "Laura",
      bloqueoVigente: false,
      permisoVigente: false,
      solicitudVigente: false,
    });

    expect(valoresFormulario.estado).toBe("disponible");
    expect(valoresFormulario.horarioInicio).toBe("");
    expect(valoresFormulario.punto).toEqual(PUNTO);
  });
});

describe("validación del rango de bloqueo", () => {
  it("acepta un rango válido del mismo día", () => {
    expect(validarRangoBloqueo("2026-12-20", "2026-12-20")).toBeNull();
  });

  it("rechaza un rango incompleto o invertido", () => {
    expect(validarRangoBloqueo("", "2026-12-20")).toContain("Indica");
    expect(validarRangoBloqueo("2026-12-20", "2026-12-01")).toContain(
      "posterior",
    );
  });
});
