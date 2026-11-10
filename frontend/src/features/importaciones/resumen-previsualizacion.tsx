import { Tarjeta } from "@/components/ui/tarjeta";
import type { PrevisualizacionImportacion } from "@/types/api";
import { formatearBytes } from "./validaciones-importacion";

function Indicador({
  etiqueta,
  valor,
  tono = "neutro",
}: {
  etiqueta: string;
  valor: number;
  tono?: "neutro" | "exito" | "advertencia" | "peligro";
}) {
  const clases = {
    neutro: "border-borde bg-fondo text-titulo",
    exito: "border-emerald-200 bg-emerald-50 text-emerald-800",
    advertencia: "border-amber-200 bg-amber-50 text-amber-800",
    peligro: "border-rose-200 bg-rose-50 text-rose-800",
  }[tono];

  return (
    <div className={`rounded-lg border px-4 py-3 ${clases}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {etiqueta}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{valor}</p>
    </div>
  );
}

/** Tarjeta de totales de la previsualización. */
export function ResumenPrevisualizacion({
  preview,
}: {
  preview: PrevisualizacionImportacion;
}) {
  return (
    <Tarjeta className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-titulo">
            Resumen de la previsualización
          </h2>
          <p className="mt-1 text-sm text-texto">
            {preview.archivo.nombre} · {formatearBytes(preview.archivo.bytes)}
          </p>
        </div>
        <p className="text-xs text-tenue">
          Origen:{" "}
          <span className="font-semibold text-titulo">
            EPSG:{preview.sridOrigen ?? 4326}
          </span>{" "}
          {preview.sridDetectado ? "(detectado del archivo)" : "(asumido)"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Indicador etiqueta="Total" valor={preview.resumen.total} />
        <Indicador
          etiqueta="Válidas"
          valor={preview.resumen.validas}
          tono="exito"
        />
        <Indicador
          etiqueta="Advertencias"
          valor={preview.resumen.advertencias}
          tono="advertencia"
        />
        <Indicador
          etiqueta="Rechazadas"
          valor={preview.resumen.rechazadas}
          tono="peligro"
        />
      </div>
    </Tarjeta>
  );
}
