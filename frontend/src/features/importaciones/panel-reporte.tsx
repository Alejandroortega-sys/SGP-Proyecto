"use client";

import Link from "next/link";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import type { ApiError } from "@/lib/api-client";
import type { ConfirmacionImportacion, TipoImportacion } from "@/types/api";

interface PanelReporteProps {
  confirmacion: ConfirmacionImportacion;
  tipo: TipoImportacion;
  descargando: boolean;
  error: ApiError | null;
  onDescargar: () => void;
  onReiniciar: () => void;
}

/** Resultado final de la importación y descarga del reporte. */
export function PanelReporte({
  confirmacion,
  tipo,
  descargando,
  error,
  onDescargar,
  onReiniciar,
}: PanelReporteProps) {
  const rutaDestino = tipo === "zonas" ? "/gestor/zonas" : "/gestor/modulos";
  const textoDestino = tipo === "zonas" ? "Ver zonas" : "Ver módulos";

  return (
    <div className="flex flex-col gap-4">
      <Alerta tono="exito">
        Importación confirmada. Se importaron{" "}
        <strong>{confirmacion.resumen.importados}</strong> registros y se
        rechazaron <strong>{confirmacion.resumen.rechazados}</strong>.
      </Alerta>

      {error ? <Alerta tono="error">{error.mensaje}</Alerta> : null}

      <Tarjeta>
        <TarjetaEncabezado>
          <h2 className="text-base font-bold text-titulo">
            Resumen de la importación
          </h2>
          <p className="mt-1 text-sm text-texto">
            Total: {confirmacion.resumen.total} · Importados:{" "}
            {confirmacion.resumen.importados} · Rechazados:{" "}
            {confirmacion.resumen.rechazados}
            {confirmacion.resumen.conAdvertencia > 0
              ? ` · Con advertencia: ${confirmacion.resumen.conAdvertencia}`
              : ""}
          </p>
        </TarjetaEncabezado>
        <TarjetaCuerpo className="flex flex-wrap gap-3">
          <Boton
            onClick={onDescargar}
            cargando={descargando}
            disabled={!confirmacion.reporte.disponible}
          >
            Descargar reporte de errores (CSV)
          </Boton>
          <Link
            href={rutaDestino}
            className="inline-flex min-h-11 items-center rounded-lg border border-primario px-4 py-2.5 text-sm font-semibold text-primario hover:bg-primario-suave"
          >
            {textoDestino}
          </Link>
          <Boton variante="fantasma" onClick={onReiniciar}>
            Importar otro archivo
          </Boton>
          {!confirmacion.reporte.disponible ? (
            <p className="w-full text-xs text-tenue">
              No hubo filas rechazadas: el reporte de errores no está
              disponible para esta importación.
            </p>
          ) : null}
        </TarjetaCuerpo>
      </Tarjeta>

      {confirmacion.rechazados.length > 0 ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">
              Filas rechazadas
            </h2>
            <p className="mt-1 text-sm text-texto">
              Estas filas no se importaron. El reporte CSV contiene el mismo
              detalle.
            </p>
          </TarjetaEncabezado>
          <TarjetaCuerpo>
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {confirmacion.rechazados.map((rechazado) => (
                <li
                  key={rechazado.fila}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800"
                >
                  <span className="font-semibold">Fila {rechazado.fila}:</span>{" "}
                  {rechazado.motivo}
                </li>
              ))}
            </ul>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : null}

      {confirmacion.importados.length > 0 ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">
              Registros importados
            </h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {confirmacion.importados.map((importado) => (
                <li key={`${importado.fila}-${importado.id}`}>
                  <span className="font-semibold text-titulo">
                    {importado.codigo ?? importado.id}
                  </span>{" "}
                  <span className="text-texto">
                    {importado.nombre} (fila {importado.fila})
                  </span>
                </li>
              ))}
            </ul>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : null}
    </div>
  );
}
