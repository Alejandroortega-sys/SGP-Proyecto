import { describe, expect, it } from "vitest";
import type {
  DatosRadicacionSolicitud,
  DisponibilidadSolicitud,
  RequisitoDocumental,
} from "@/types/api";
import {
  hoyISO,
  validarArchivoDocumento,
  validarPasoActividad,
  validarPasoDocumentos,
  validarPasoHorario,
  validarPasoUbicacion,
  validarSolicitudCompleta,
  type ArchivoAdjuntoSolicitud,
} from "./validaciones-solicitud";

function fechaFutura(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const VALORES: DatosRadicacionSolicitud = {
  espacioId: "1",
  actividad: "Artesanías",
  productoIds: ["1"],
  fechaInicio: fechaFutura(7),
  fechaFin: fechaFutura(9),
  horaInicio: "09:00",
  horaFin: "12:00",
};

const REQUISITOS: RequisitoDocumental[] = [
  {
    id: "1",
    nombre: "Documento de identidad",
    descripcion: null,
    obligatorio: true,
    tipoActividad: null,
    orden: 10,
  },
  {
    id: "2",
    nombre: "RUT",
    descripcion: null,
    obligatorio: true,
    tipoActividad: null,
    orden: 20,
  },
];

function archivo(
  requisitoId: string,
  nombre: string,
  tipo = "application/pdf",
): ArchivoAdjuntoSolicitud {
  const file = new File([new Uint8Array([1, 2, 3])], nombre, { type: tipo });
  return {
    requisitoId,
    archivo: file,
    nombre,
    tipo,
    tamano: file.size,
  };
}

const DISPONIBLE: DisponibilidadSolicitud = {
  disponible: true,
  motivo: null,
  espacio: { id: "1", nombre: "Kiosco" },
};

describe("validaciones de solicitud", () => {
  it("exige seleccionar un espacio", () => {
    expect(validarPasoUbicacion({ ...VALORES, espacioId: "" })).toEqual({
      espacio: expect.stringContaining("Selecciona"),
    });
    expect(validarPasoUbicacion(VALORES)).toEqual({});
  });

  it("valida actividad y productos", () => {
    expect(
      validarPasoActividad({ ...VALORES, actividad: "x" }, ["1"]).actividad,
    ).toContain("3 caracteres");
    expect(
      validarPasoActividad({ ...VALORES, productoIds: [] }, ["1"]).productos,
    ).toContain("al menos un producto");
    expect(
      validarPasoActividad({ ...VALORES, productoIds: ["2"] }, ["1"]).productos,
    ).toContain("no está permitido");
    expect(validarPasoActividad(VALORES, ["1"])).toEqual({});
  });

  it("exige los documentos obligatorios", () => {
    const error = validarPasoDocumentos(REQUISITOS, [archivo("1", "cedula.pdf")]);
    expect(error.documentos).toContain("RUT");
    expect(
      validarPasoDocumentos(REQUISITOS, [
        archivo("1", "cedula.pdf"),
        archivo("2", "rut.pdf"),
      ]),
    ).toEqual({});
  });

  it("valida fechas, horas y disponibilidad", () => {
    const horario = { inicio: "08:00", fin: "18:00" };
    expect(validarPasoHorario(VALORES, horario, DISPONIBLE)).toEqual({});

    const pasada = validarPasoHorario(
      { ...VALORES, fechaInicio: "2020-01-01", fechaFin: "2020-01-02" },
      horario,
      DISPONIBLE,
    );
    expect(pasada.fechas).toContain("anterior a hoy");

    const invertida = validarPasoHorario(
      { ...VALORES, fechaFin: fechaFutura(1) },
      horario,
      DISPONIBLE,
    );
    expect(invertida.fechas).toContain("igual o posterior");

    const fueraDeHorario = validarPasoHorario(
      { ...VALORES, horaInicio: "07:00" },
      horario,
      DISPONIBLE,
    );
    expect(fueraDeHorario.horas).toContain("08:00");

    const noDisponible = validarPasoHorario(VALORES, horario, {
      disponible: false,
      motivo: "Ocupado",
      espacio: { id: "1", nombre: "Kiosco" },
    });
    expect(noDisponible.disponibilidad).toBe("Ocupado");
  });

  it("valida el formulario completo", () => {
    const errores = validarSolicitudCompleta(
      VALORES,
      REQUISITOS,
      [archivo("1", "cedula.pdf"), archivo("2", "rut.pdf")],
      { inicio: "08:00", fin: "18:00" },
      DISPONIBLE,
      ["1"],
    );
    expect(errores).toEqual({});
  });

  it("valida tipo y tamaño de los archivos", () => {
    expect(
      validarArchivoDocumento(
        new File([new Uint8Array([1])], "a.txt", { type: "text/plain" }),
      ),
    ).toContain("PDF, JPG o PNG");
    expect(validarArchivoDocumento(archivo("1", "cedula.pdf").archivo)).toBeNull();
  });

  it("entrega la fecha de hoy en Colombia", () => {
    expect(hoyISO(new Date("2026-11-21T03:00:00.000Z"))).toBe("2026-11-20");
  });
});
