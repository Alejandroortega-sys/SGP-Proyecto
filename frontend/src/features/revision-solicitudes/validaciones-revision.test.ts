import { describe, expect, it } from "vitest";
import type { RequisitoRevision, SolicitudRevisionDetalle } from "@/types/api";
import {
  describirBloqueo,
  parametrosRevision,
  puedeEditarRevision,
  requisitosNoCumple,
  textoAntiguedad,
  validarObservacionDevolucion,
  validarObservacionNoCumple,
} from "./validaciones-revision";

const AHORA = new Date("2026-11-21T12:00:00.000Z");

const BLOQUEO = {
  solicitudId: "12",
  gestor: {
    id: "1",
    nombre: "Laura",
    apellido: "Martínez",
    perfil: "administrador" as const,
  },
  iniciadaEn: "2026-11-21T11:00:00.000Z",
  ultimaActividad: "2026-11-21T11:50:00.000Z",
  expiraEn: "2026-11-21T12:10:00.000Z",
  esPropio: true,
};

const REQUISITO: RequisitoRevision = {
  id: "1",
  nombre: "RUT",
  descripcion: null,
  obligatorio: true,
  tipoActividad: null,
  orden: 10,
  estado: "no_cumple",
  documentoActual: null,
  versiones: [],
  observacion: "RUT vencido",
  verificadoEn: "2026-11-21T11:00:00.000Z",
  verificadoPor: { id: "1", nombre: "Laura", apellido: "Martínez" },
};

function solicitud(
  cambios: Partial<SolicitudRevisionDetalle> = {},
): SolicitudRevisionDetalle {
  return {
    id: "12",
    numeroRadicado: "SOL-2026-00012",
    estado: "en_revision",
    actividad: "Artesanías",
    fechaInicio: "2026-12-01",
    fechaFin: "2026-12-03",
    horaInicio: "09:00",
    horaFin: "12:00",
    radicadaEn: "2026-11-20T10:00:00.000Z",
    creadoEn: "2026-11-20T10:00:00.000Z",
    comerciante: {
      id: "3",
      nombre: "María",
      apellido: "Gómez",
      correo: "maria.gomez@gmail.com",
      documento: null,
      telefono: null,
      actividadComercial: null,
      categoria: null,
    },
    espacio: null,
    documentosCargados: 1,
    requisitosVerificados: 1,
    requisitosNoCumplen: 1,
    bloqueo: BLOQUEO,
    decididaEn: null,
    motivoRechazo: null,
    actualizadoEn: "2026-11-20T10:00:00.000Z",
    productos: [],
    requisitos: [REQUISITO],
    otrosDocumentos: [],
    historial: [],
    progreso: {
      total: 1,
      pendientes: 0,
      verificados: 1,
      cumple: 0,
      noCumple: 1,
    },
    puedeVerificar: true,
    motivoBloqueo: null,
    ...cambios,
  };
}

describe("validaciones de revisión", () => {
  it("solo permite editar con la solicitud en revisión y bloqueo propio", () => {
    expect(puedeEditarRevision(solicitud())).toBe(true);
    expect(puedeEditarRevision(solicitud({ puedeVerificar: false }))).toBe(
      false,
    );
    expect(puedeEditarRevision(solicitud({ estado: "devuelta" }))).toBe(false);
  });

  it("exige observación en la devolución", () => {
    expect(validarObservacionDevolucion("   ")).toContain("observación");
    expect(validarObservacionDevolucion("Corregir el RUT")).toBeNull();
  });

  it("exige observación al marcar No cumple", () => {
    expect(validarObservacionNoCumple("")).toContain("No cumple");
    expect(validarObservacionNoCumple("RUT vencido")).toBeNull();
  });

  it("lista los requisitos no cumplidos", () => {
    expect(requisitosNoCumple([REQUISITO])).toHaveLength(1);
    expect(
      requisitosNoCumple([{ ...REQUISITO, estado: "cumple" }]),
    ).toHaveLength(0);
  });

  it("describe el bloqueo propio con la hora de expiración", () => {
    const aviso = describirBloqueo(solicitud(), AHORA);
    expect(aviso.tono).toBe("info");
    expect(aviso.texto).toContain("Tienes el bloqueo");
    expect(aviso.texto).toContain("10 min");
  });

  it("describe el bloqueo de otro gestor", () => {
    const aviso = describirBloqueo(
      solicitud({
        bloqueo: {
          ...BLOQUEO,
          esPropio: false,
          gestor: { ...BLOQUEO.gestor, nombre: "Carlos", apellido: "Ríos" },
        },
      }),
      AHORA,
    );
    expect(aviso.tono).toBe("advertencia");
    expect(aviso.texto).toContain("Carlos Ríos");
  });

  it("avisa cuando no hay bloqueo en revisión", () => {
    const aviso = describirBloqueo(
      solicitud({
        bloqueo: null,
        puedeVerificar: false,
        motivoBloqueo: null,
      }),
      AHORA,
    );
    expect(aviso.tono).toBe("advertencia");
    expect(aviso.texto).toContain("no tiene un bloqueo activo");
  });

  it("construye los parámetros sin valores vacíos", () => {
    expect(
      parametrosRevision({
        estado: "radicada",
        sector: "  ",
        actividad: "Artesanías",
        orden: "reciente",
      }),
    ).toEqual({
      estado: "radicada",
      sector: undefined,
      actividad: "Artesanías",
      orden: "reciente",
      pagina: undefined,
      limite: undefined,
    });
  });

  it("calcula la antigüedad en días", () => {
    expect(textoAntiguedad("2026-11-21T10:00:00.000Z", AHORA)).toBe(
      "Radicada hoy",
    );
    expect(textoAntiguedad("2026-11-20T10:00:00.000Z", AHORA)).toBe(
      "Radicada hace 1 día",
    );
    expect(textoAntiguedad("2026-11-10T10:00:00.000Z", AHORA)).toBe(
      "Radicada hace 11 días",
    );
  });
});
