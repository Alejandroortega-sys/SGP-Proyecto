"use client";

import { Alerta } from "@/components/ui/alerta";
import { Campo } from "@/components/ui/campo";
import { Spinner } from "@/components/ui/spinner";
import { formatearHorarioEspacio } from "@/features/espacios/estilos-espacio";
import { formatearHorario } from "@/features/mapa/estilos-zona";
import type {
  DatosRadicacionSolicitud,
  DisponibilidadSolicitud,
  EspacioDetalle,
} from "@/types/api";
import { hoyISO, type ErroresSolicitud } from "./validaciones-solicitud";

interface PasoHorarioProps {
  valores: DatosRadicacionSolicitud;
  errores: ErroresSolicitud;
  espacio: EspacioDetalle | null;
  disponibilidad: DisponibilidadSolicitud | null;
  consultandoDisponibilidad: boolean;
  onCambiar: (parcial: Partial<DatosRadicacionSolicitud>) => void;
}

/** Cuarto paso: fechas, horario y verificación de disponibilidad. */
export function PasoHorario({
  valores,
  errores,
  espacio,
  disponibilidad,
  consultandoDisponibilidad,
  onCambiar,
}: PasoHorarioProps) {
  const hoy = hoyISO();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-titulo">Horario</h2>
        <p className="mt-1 text-sm text-texto">
          Indica el rango de fechas y el horario en que usarás el espacio. El
          sistema comprobará que quepa en el horario permitido y que no haya
          bloqueos u ocupaciones.
        </p>
      </div>

      {espacio ? (
        <div className="rounded-lg border border-borde bg-fondo p-3 text-sm text-texto">
          <p className="font-semibold text-titulo">Horario permitido</p>
          <p className="mt-1">
            {formatearHorarioEspacio(espacio.horario)}
            {espacio.zona ? (
              <span className="text-tenue">
                {" "}
                · Zona {espacio.zona.nombre}:{" "}
                {formatearHorario({
                  inicio: espacio.zona.horarioInicio,
                  fin: espacio.zona.horarioFin,
                })}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Fecha de inicio"
          type="date"
          requerido
          min={hoy}
          value={valores.fechaInicio}
          error={errores.fechas}
          onChange={(evento) => onCambiar({ fechaInicio: evento.target.value })}
        />
        <Campo
          etiqueta="Fecha de fin"
          type="date"
          requerido
          min={valores.fechaInicio || hoy}
          value={valores.fechaFin}
          onChange={(evento) => onCambiar({ fechaFin: evento.target.value })}
        />
        <Campo
          etiqueta="Hora de inicio"
          type="time"
          requerido
          value={valores.horaInicio}
          error={errores.horas}
          onChange={(evento) => onCambiar({ horaInicio: evento.target.value })}
        />
        <Campo
          etiqueta="Hora de fin"
          type="time"
          requerido
          value={valores.horaFin}
          onChange={(evento) => onCambiar({ horaFin: evento.target.value })}
        />
      </div>

      {errores.disponibilidad ? (
        <Alerta tono="error">{errores.disponibilidad}</Alerta>
      ) : null}

      {consultandoDisponibilidad ? (
        <span
          role="status"
          className="inline-flex items-center gap-2 text-sm text-texto"
        >
          <Spinner className="size-4 text-primario" />
          Verificando la disponibilidad del espacio…
        </span>
      ) : disponibilidad?.disponible ? (
        <Alerta tono="exito">
          El espacio está disponible para las fechas y el horario indicados.
        </Alerta>
      ) : disponibilidad && !disponibilidad.disponible ? (
        <Alerta tono="advertencia">
          <p className="font-semibold">No se puede radicar con este horario.</p>
          <p className="mt-1">{disponibilidad.motivo}</p>
        </Alerta>
      ) : (
        <p className="text-sm text-tenue">
          Completa las fechas y el horario para verificar la disponibilidad.
        </p>
      )}
    </div>
  );
}
