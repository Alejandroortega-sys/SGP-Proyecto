"use client";

import type { ReactNode } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import type {
  DatosRadicacionSolicitud,
  DisponibilidadSolicitud,
  EspacioDetalle,
  Producto,
  RequisitoDocumental,
} from "@/types/api";
import type {
  ArchivoAdjuntoSolicitud,
  ErroresSolicitud,
} from "./validaciones-solicitud";
import { formatearBytes } from "./validaciones-solicitud";

interface PasoResumenProps {
  valores: DatosRadicacionSolicitud;
  espacio: EspacioDetalle | null;
  productos: Producto[];
  requisitos: RequisitoDocumental[];
  adjuntos: ArchivoAdjuntoSolicitud[];
  errores: ErroresSolicitud;
  disponibilidad: DisponibilidadSolicitud | null;
  radicando: boolean;
  onEditarPaso: (paso: number) => void;
  onRadicar: () => void;
}

function SeccionResumen({
  titulo,
  paso,
  onEditarPaso,
  children,
}: {
  titulo: string;
  paso: number;
  onEditarPaso: (paso: number) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-borde bg-superficie p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-titulo">{titulo}</h3>
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={() => onEditarPaso(paso)}
        >
          Editar
        </Boton>
      </div>
      <div className="mt-2 text-sm text-texto">{children}</div>
    </section>
  );
}

/** Quinto paso: revisión final y radicación. */
export function PasoResumen({
  valores,
  espacio,
  productos,
  requisitos,
  adjuntos,
  errores,
  disponibilidad,
  radicando,
  onEditarPaso,
  onRadicar,
}: PasoResumenProps) {
  const productosSeleccionados = productos.filter((producto) =>
    valores.productoIds.includes(producto.id),
  );
  const requisitosCargados = requisitos.filter((requisito) =>
    adjuntos.some((adjunto) => adjunto.requisitoId === requisito.id),
  );
  const faltaDisponibilidad = !disponibilidad?.disponible;
  const hayErrores = Object.values(errores).some(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold text-titulo">Resumen y radicación</h2>
        <p className="mt-1 text-sm text-texto">
          Revisa la información antes de radicar. Al confirmar, la solicitud
          quedará en estado «Radicada» y recibirás un correo de confirmación.
        </p>
      </div>

      {hayErrores ? (
        <Alerta tono="error">
          <p className="font-semibold">Revisa los siguientes puntos:</p>
          <ul className="mt-1 list-disc pl-5">
            {Object.values(errores)
              .filter(Boolean)
              .map((error, indice) => (
                <li key={`${indice}-${error}`}>{error}</li>
              ))}
          </ul>
        </Alerta>
      ) : null}

      {faltaDisponibilidad ? (
        <Alerta tono="advertencia">
          {disponibilidad?.motivo ??
            "Debes verificar la disponibilidad del espacio antes de radicar."}
        </Alerta>
      ) : null}

      <SeccionResumen titulo="Ubicación" paso={1} onEditarPaso={onEditarPaso}>
        {espacio ? (
          <>
            <p className="font-semibold text-titulo">{espacio.nombre}</p>
            <p>{espacio.sector ?? "Sin sector registrado"}</p>
          </>
        ) : (
          <p>Sin espacio seleccionado.</p>
        )}
      </SeccionResumen>

      <SeccionResumen titulo="Actividad y productos" paso={2} onEditarPaso={onEditarPaso}>
        <p className="font-semibold text-titulo">{valores.actividad || "Sin actividad"}</p>
        <p className="mt-1">
          {productosSeleccionados.length > 0
            ? productosSeleccionados.map((producto) => producto.nombre).join(", ")
            : "Sin productos seleccionados."}
        </p>
      </SeccionResumen>

      <SeccionResumen titulo="Documentos" paso={3} onEditarPaso={onEditarPaso}>
        {requisitosCargados.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {requisitosCargados.map((requisito) => {
              const adjunto = adjuntos.find(
                (candidato) => candidato.requisitoId === requisito.id,
              );
              return (
                <li key={requisito.id} className="flex flex-wrap gap-2">
                  <span className="font-medium text-titulo">
                    {requisito.nombre}:
                  </span>
                  <span className="min-w-0 break-all">
                    {adjunto?.nombre ?? "Archivo adjunto"}
                    {adjunto ? ` (${formatearBytes(adjunto.tamano)})` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Sin documentos adjuntos.</p>
        )}
        {requisitos.some((requisito) => requisito.obligatorio) ? (
          <p className="mt-2 text-xs text-tenue">
            Los documentos obligatorios ya están incluidos.
          </p>
        ) : null}
      </SeccionResumen>

      <SeccionResumen titulo="Fechas y horario" paso={4} onEditarPaso={onEditarPaso}>
        <p>
          {valores.fechaInicio && valores.fechaFin
            ? formatearRangoFechas(valores.fechaInicio, valores.fechaFin)
            : "Sin fechas definidas."}
        </p>
        <p className="mt-1">
          {valores.horaInicio && valores.horaFin
            ? `${valores.horaInicio} a ${valores.horaFin}`
            : "Sin horario definido."}
        </p>
      </SeccionResumen>

      <Boton
        onClick={onRadicar}
        cargando={radicando}
        disabled={hayErrores || faltaDisponibilidad}
        anchoCompleto
        tamano="lg"
      >
        Radicar solicitud
      </Boton>
    </div>
  );
}
