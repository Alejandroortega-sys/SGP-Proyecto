"use client";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { Spinner } from "@/components/ui/spinner";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { formatearHorario } from "@/features/mapa/estilos-zona";
import type {
  AgendaFeria,
  DisponibilidadFeria,
  RangoFeria,
  ZonaFeria,
} from "@/types/api";
import { hoyISO, type ErroresFeria, type ValoresFeria } from "./validaciones-feria";

interface SelectorZonaFechasProps {
  valores: ValoresFeria;
  errores: ErroresFeria;
  zonas: ZonaFeria[];
  zona: ZonaFeria | null;
  agenda: AgendaFeria | null;
  disponibilidad: DisponibilidadFeria | null;
  consultando: boolean;
  errorConsulta?: string | null;
  onCambiar: (parcial: Partial<ValoresFeria>) => void;
  onAplicarSugerencia: (rango: RangoFeria) => void;
}

/**
 * Selector de zona, fechas y puestos con la disponibilidad de la agenda.
 *
 * Muestra los rangos ocupados sin identificar a otros organizadores y ofrece
 * fechas alternativas cuando el rango solicitado se cruza.
 */
export function SelectorZonaFechas({
  valores,
  errores,
  zonas,
  zona,
  agenda,
  disponibilidad,
  consultando,
  errorConsulta,
  onCambiar,
  onAplicarSugerencia,
}: SelectorZonaFechasProps) {
  const hoy = hoyISO();
  const aforo = zona?.aforoMaximo ?? null;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-titulo">Zona y fechas</h2>
        <p className="mt-1 text-sm text-texto">
          Elige la zona y el rango en que se realizará la feria. La agenda
          muestra únicamente los rangos ocupados, sin datos de otros
          organizadores.
        </p>
      </div>

      <Selector
        etiqueta="Zona"
        requerido
        value={valores.zonaId}
        error={errores.zonaId}
        onChange={(evento) => onCambiar({ zonaId: evento.target.value })}
      >
        <option value="">Selecciona una zona</option>
        {zonas.map((opcion) => (
          <option
            key={opcion.id}
            value={opcion.id}
            disabled={!opcion.admiteFerias}
          >
            {opcion.nombre}
            {opcion.aforoMaximo
              ? ` · aforo ${opcion.aforoMaximo}`
              : " · sin aforo"}
          </option>
        ))}
      </Selector>

      {zona ? (
        <div className="grid gap-3 rounded-lg border border-borde bg-fondo p-4 text-sm text-texto sm:grid-cols-3">
          <div>
            <p className="font-semibold text-titulo">Aforo máximo</p>
            <p>{zona.aforoMaximo ?? "Sin definir"}</p>
          </div>
          <div>
            <p className="font-semibold text-titulo">Horario</p>
            <p>
              {formatearHorario({
                inicio: zona.horarioInicio,
                fin: zona.horarioFin,
              })}
            </p>
          </div>
          <div>
            <p className="font-semibold text-titulo">Productos permitidos</p>
            <p>
              {zona.productosPermitidos.length > 0
                ? zona.productosPermitidos.join(", ")
                : "Sin restricción de productos"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Fecha de inicio"
          type="date"
          requerido
          min={hoy}
          value={valores.fechaInicio}
          error={errores.fechaInicio}
          onChange={(evento) => onCambiar({ fechaInicio: evento.target.value })}
        />
        <Campo
          etiqueta="Fecha de fin"
          type="date"
          requerido
          min={valores.fechaInicio || hoy}
          value={valores.fechaFin}
          error={errores.fechaFin}
          onChange={(evento) => onCambiar({ fechaFin: evento.target.value })}
        />
        <Campo
          etiqueta="Número de puestos"
          type="number"
          requerido
          min={1}
          max={aforo ?? undefined}
          inputMode="numeric"
          value={valores.numeroPuestos}
          error={errores.numeroPuestos}
          ayuda={
            aforo
              ? `La zona admite hasta ${aforo} puestos.`
              : "Selecciona una zona para conocer su aforo."
          }
          onChange={(evento) =>
            onCambiar({ numeroPuestos: evento.target.value })
          }
        />
      </div>

      {agenda && agenda.ocupados.length > 0 ? (
        <div className="rounded-lg border border-borde bg-superficie p-4">
          <p className="text-sm font-semibold text-titulo">
            Ocupación de la zona
          </p>
          <p className="mt-1 text-xs text-tenue">
            Fechas con otra feria radicada o aprobada.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {agenda.ocupados.slice(0, 8).map((rango) => (
              <li
                key={`${rango.fechaInicio}-${rango.fechaFin}`}
                className="rounded-full border border-advertencia-borde bg-advertencia-suave px-3 py-1 text-xs font-medium text-advertencia-texto"
              >
                {formatearRangoFechas(rango.fechaInicio, rango.fechaFin)}
              </li>
            ))}
          </ul>
        </div>
      ) : zona && agenda ? (
        <p className="text-sm text-tenue">
          No hay ferias activas en esta zona dentro del rango consultado.
        </p>
      ) : null}

      {errorConsulta ? (
        <Alerta tono="error">{errorConsulta}</Alerta>
      ) : consultando ? (
        <span
          role="status"
          className="inline-flex items-center gap-2 text-sm text-texto"
        >
          <Spinner className="size-4 text-accent-texto" />
          Verificando la disponibilidad de la zona…
        </span>
      ) : disponibilidad?.disponible ? (
        <Alerta tono="exito">
          La zona está libre para las fechas y el número de puestos indicados.
        </Alerta>
      ) : disponibilidad ? (
        <div className="flex flex-col gap-3">
          <Alerta tono="advertencia">
            <p className="font-semibold">No se puede radicar con esos datos.</p>
            <p className="mt-1">{disponibilidad.motivo}</p>
          </Alerta>

          {disponibilidad.sugerencias.length > 0 ? (
            <div className="rounded-lg border border-info-borde bg-info-suave p-4">
              <p className="text-sm font-bold text-info-texto">
                Fechas alternativas disponibles
              </p>
              <p className="mt-1 text-sm text-info-texto">
                Conservan la misma duración de la feria.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {disponibilidad.sugerencias.map((rango) => (
                  <li key={`${rango.fechaInicio}-${rango.fechaFin}`}>
                    <Boton
                      variante="contorno"
                      tamano="sm"
                      onClick={() => onAplicarSugerencia(rango)}
                    >
                      {formatearRangoFechas(
                        rango.fechaInicio,
                        rango.fechaFin,
                      )}
                    </Boton>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-tenue">
          Completa la zona, las fechas y los puestos para verificar la
          disponibilidad.
        </p>
      )}
    </section>
  );
}
