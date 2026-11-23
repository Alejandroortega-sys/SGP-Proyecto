import { describe, expect, it } from "vitest";
import type { EventoAgendaFeria } from "@/types/api";
import {
  contarPorEstado,
  desplazarSemana,
  diasDeSemana,
  estaEnRango,
  eventosDelDia,
  eventosDeZona,
  generarCuadricula,
  iniciaEnDia,
  inicioSemana,
  rangoMes,
  rangoSemana,
} from "./calendario-ferias-utilidades";

function evento(
  datos: Partial<EventoAgendaFeria> & {
    id: string;
    fechaInicio: string;
    fechaFin: string;
  },
): EventoAgendaFeria {
  const { id, fechaInicio, fechaFin, ...resto } = datos;
  return {
    id,
    numeroRadicado: `FER-2026-${id.padStart(5, "0")}`,
    nombre: `Feria ${id}`,
    tipoFeria: "Feria agroecológica",
    estado: "radicada",
    fechaInicio,
    fechaFin,
    numeroPuestos: 10,
    zona: {
      id: "4",
      nombre: "Parque La Guadua",
      tipo: "permitida",
      activa: true,
      aforoMaximo: 25,
      horarioInicio: "06:00",
      horarioFin: "20:00",
    },
    organizador: {
      id: "7",
      nombre: "Luis",
      apellido: "Álvarez",
      correo: "luis@example.com",
      organizacion: "Fundación",
      nit: "901234567-8",
    },
    tieneCruces: false,
    motivoCancelacion: null,
    aprobadaEn: null,
    canceladaEn: null,
    ...resto,
  };
}

describe("calendario de ferias", () => {
  it("genera una cuadrícula mensual de 42 días que empieza en lunes", () => {
    const dias = generarCuadricula({ anio: 2026, mes: 12 });
    expect(dias).toHaveLength(42);
    expect(dias[0]?.fecha).toBe("2026-11-30");
    expect(dias[41]?.fecha).toBe("2027-01-10");
    expect(dias.filter((dia) => dia.delMes)).toHaveLength(31);
  });

  it("calcula el rango del mes y de la semana", () => {
    expect(rangoMes({ anio: 2026, mes: 2 })).toEqual({
      desde: "2026-02-01",
      hasta: "2026-02-28",
    });
    expect(inicioSemana("2026-12-09")).toBe("2026-12-07");
    expect(diasDeSemana("2026-12-09")).toEqual([
      "2026-12-07",
      "2026-12-08",
      "2026-12-09",
      "2026-12-10",
      "2026-12-11",
      "2026-12-12",
      "2026-12-13",
    ]);
    expect(rangoSemana("2026-12-09")).toEqual({
      desde: "2026-12-07",
      hasta: "2026-12-13",
    });
    expect(desplazarSemana("2026-12-31", 1)).toBe("2027-01-04");
  });

  it("detecta la presencia de eventos en días y zonas", () => {
    const feria = evento({
      id: "1",
      fechaInicio: "2026-12-10",
      fechaFin: "2026-12-12",
    });
    expect(estaEnRango("2026-12-11", "2026-12-10", "2026-12-12")).toBe(true);
    expect(estaEnRango("2026-12-13", "2026-12-10", "2026-12-12")).toBe(false);
    expect(eventosDelDia("2026-12-11", [feria])).toHaveLength(1);
    expect(eventosDelDia("2026-12-09", [feria])).toHaveLength(0);
    expect(eventosDeZona([feria], "4")).toHaveLength(1);
    expect(eventosDeZona([feria], "5")).toHaveLength(0);
    expect(iniciaEnDia(feria, "2026-12-10")).toBe(true);
    expect(iniciaEnDia(feria, "2026-12-11")).toBe(false);
  });

  it("cuenta eventos por estado", () => {
    const eventos = [
      evento({ id: "1", fechaInicio: "2026-12-01", fechaFin: "2026-12-01" }),
      evento({
        id: "2",
        fechaInicio: "2026-12-02",
        fechaFin: "2026-12-02",
        estado: "aprobada",
      }),
      evento({
        id: "3",
        fechaInicio: "2026-12-03",
        fechaFin: "2026-12-03",
        estado: "cancelada",
      }),
    ];
    expect(contarPorEstado(eventos)).toMatchObject({
      radicada: 1,
      aprobada: 1,
      cancelada: 1,
      rechazada: 0,
      realizada: 0,
    });
  });
});
