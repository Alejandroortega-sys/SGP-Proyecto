"use client";

import { Boton } from "@/components/ui/boton";
import { Tabla, Td, Th } from "@/components/ui/tabla";
import type { EspacioListado } from "@/types/api";
import {
  formatearDimensiones,
  formatearHorarioEspacio,
  formatearTipoEspacio,
} from "./estilos-espacio";
import { EtiquetaEstadoEspacio } from "./etiqueta-espacio";

interface TablaEspaciosProps {
  espacios: EspacioListado[];
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
}

function nombreZona(espacio: EspacioListado): string {
  return espacio.zona?.nombre ?? "Sin zona asociada";
}

/** Tabla de escritorio y tarjetas de móvil para los espacios. */
export function TablaEspacios({
  espacios,
  seleccionadoId,
  onSeleccionar,
}: TablaEspaciosProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-borde bg-superficie md:block">
        <Tabla>
          <thead>
            <tr>
              <Th>Espacio</Th>
              <Th>Tipo</Th>
              <Th>Sector</Th>
              <Th>Dimensiones</Th>
              <Th>Horario</Th>
              <Th>Zona</Th>
              <Th>Estado</Th>
              <Th>
                <span className="sr-only">Acciones</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {espacios.map((espacio) => (
              <tr
                key={espacio.id}
                className={
                  espacio.id === seleccionadoId
                    ? "bg-primario-suave/60"
                    : "hover:bg-fondo"
                }
              >
                <Td className="min-w-48">
                  <p className="font-semibold text-titulo">{espacio.nombre}</p>
                  <p className="mt-0.5 text-xs text-tenue">
                    {espacio.actividadPermitida ?? "Sin actividad registrada"}
                  </p>
                </Td>
                <Td>{formatearTipoEspacio(espacio.tipo)}</Td>
                <Td>{espacio.sector ?? "—"}</Td>
                <Td>{formatearDimensiones(espacio.dimensiones)}</Td>
                <Td className="whitespace-nowrap">
                  {formatearHorarioEspacio(espacio.horario)}
                </Td>
                <Td className="min-w-36">{nombreZona(espacio)}</Td>
                <Td>
                  <EtiquetaEstadoEspacio estado={espacio.estadoEfectivo} />
                </Td>
                <Td>
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    onClick={() => onSeleccionar(espacio.id)}
                    aria-label={`Ver ficha de ${espacio.nombre}`}
                  >
                    Ver ficha
                  </Boton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {espacios.map((espacio) => (
          <article
            key={espacio.id}
            className={
              espacio.id === seleccionadoId
                ? "rounded-xl border border-primario bg-primario-suave/50 p-4"
                : "rounded-xl border border-borde bg-superficie p-4"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-titulo">{espacio.nombre}</h3>
                <p className="mt-0.5 text-xs text-tenue">
                  {formatearTipoEspacio(espacio.tipo)} ·{" "}
                  {espacio.sector ?? "Sin sector"}
                </p>
              </div>
              <EtiquetaEstadoEspacio estado={espacio.estadoEfectivo} />
            </div>

            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="font-semibold text-titulo">Dimensiones</dt>
              <dd>{formatearDimensiones(espacio.dimensiones)}</dd>
              <dt className="font-semibold text-titulo">Horario</dt>
              <dd>{formatearHorarioEspacio(espacio.horario)}</dd>
              <dt className="font-semibold text-titulo">Zona</dt>
              <dd>{nombreZona(espacio)}</dd>
            </dl>

            <Boton
              variante="contorno"
              tamano="sm"
              className="mt-3 w-full"
              onClick={() => onSeleccionar(espacio.id)}
              aria-label={`Ver ficha de ${espacio.nombre}`}
            >
              Ver ficha
            </Boton>
          </article>
        ))}
      </div>
    </>
  );
}
