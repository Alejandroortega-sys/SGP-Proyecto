import { Etiqueta } from "@/components/ui/etiqueta";
import { Tabla, Td, Th } from "@/components/ui/tabla";
import type {
  FilaPreviewImportacion,
  TipoImportacion,
} from "@/types/api";
import {
  ETIQUETAS_ESTADO_FILA,
  formatearDato,
  resumenFilaImportacion,
  TONO_ESTADO_FILA,
} from "./validaciones-importacion";

function Motivos({ fila }: { fila: FilaPreviewImportacion }) {
  const motivos = [
    ...fila.errores.map((error) => ({ tipo: "error" as const, texto: error })),
    ...fila.advertencias.map((advertencia) => ({
      tipo: "advertencia" as const,
      texto: advertencia,
    })),
  ];

  if (motivos.length === 0) {
    return <span className="text-tenue">Sin observaciones</span>;
  }

  return (
    <ul className="space-y-1 text-xs">
      {motivos.map((motivo, indice) => (
        <li
          key={`${motivo.tipo}-${indice}`}
          className={
            motivo.tipo === "error" ? "text-rose-700" : "text-amber-700"
          }
        >
          {motivo.texto}
        </li>
      ))}
    </ul>
  );
}

function DetalleFila({
  fila,
  tipo,
}: {
  fila: FilaPreviewImportacion;
  tipo: TipoImportacion;
}) {
  const resumen = resumenFilaImportacion(fila, tipo);

  return (
    <div className="min-w-0">
      <p className="font-semibold text-titulo">{resumen.titulo}</p>
      <p className="mt-0.5 text-xs text-tenue">{resumen.detalle}</p>
      {fila.zonaContenedora ? (
        <p className="mt-1 text-xs text-texto">
          Zona contenedora:{" "}
          <span className="font-semibold">
            {fila.zonaContenedora.nombre}
          </span>{" "}
          ({formatearDato(fila.zonaContenedora.tipo)})
        </p>
      ) : null}
    </div>
  );
}

/** Tabla de filas en escritorio y tarjetas en móvil. */
export function TablaPrevisualizacion({
  tipo,
  filas,
}: {
  tipo: TipoImportacion;
  filas: readonly FilaPreviewImportacion[];
}) {
  return (
    <div>
      <div className="hidden overflow-x-auto sm:block">
        <Tabla>
          <thead>
            <tr>
              <Th>Fila</Th>
              <Th>Estado</Th>
              <Th>Datos</Th>
              <Th>Observaciones</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.fila}>
                <Td className="align-top font-semibold text-titulo">
                  {fila.fila}
                </Td>
                <Td className="align-top">
                  <Etiqueta tono={TONO_ESTADO_FILA[fila.estado]}>
                    {ETIQUETAS_ESTADO_FILA[fila.estado]}
                  </Etiqueta>
                  {fila.requiereConfirmacion ? (
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      Requiere confirmación
                    </p>
                  ) : null}
                </Td>
                <Td className="align-top">
                  <DetalleFila fila={fila} tipo={tipo} />
                </Td>
                <Td className="align-top">
                  <Motivos fila={fila} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </div>

      <div className="flex flex-col gap-3 p-4 sm:hidden">
        {filas.map((fila) => (
          <article
            key={fila.fila}
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-titulo">Fila {fila.fila}</p>
              <Etiqueta tono={TONO_ESTADO_FILA[fila.estado]}>
                {ETIQUETAS_ESTADO_FILA[fila.estado]}
              </Etiqueta>
            </div>
            <div className="mt-2">
              <DetalleFila fila={fila} tipo={tipo} />
            </div>
            {fila.requiereConfirmacion ? (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                Requiere confirmación
              </p>
            ) : null}
            <div className="mt-3 border-t border-borde pt-2">
              <Motivos fila={fila} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
