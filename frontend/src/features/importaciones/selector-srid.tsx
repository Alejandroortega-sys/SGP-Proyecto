"use client";

import { Campo, Selector } from "@/components/ui/campo";
import type { SridsImportacion } from "@/types/api";

interface SelectorSridProps {
  opciones: SridsImportacion | null;
  valor: string;
  otro: string;
  error?: string | null;
  deshabilitado?: boolean;
  onCambiar: (valor: string) => void;
  onCambiarOtro: (valor: string) => void;
}

/**
 * Selector del sistema de referencia de origen.
 *
 * «auto» usa el miembro `crs` del archivo o EPSG:4326. Las opciones comunes
 * vienen de `spatial_ref_sys`; «otro» permite escribir cualquier EPSG.
 */
export function SelectorSrid({
  opciones,
  valor,
  otro,
  error,
  deshabilitado = false,
  onCambiar,
  onCambiarOtro,
}: SelectorSridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Selector
        etiqueta="Sistema de referencia de origen"
        ayuda="Si el archivo declara un CRS, debe coincidir con esta selección."
        value={valor}
        disabled={deshabilitado}
        onChange={(evento) => onCambiar(evento.target.value)}
      >
        <option value="auto">Detectar del archivo (o EPSG:4326)</option>
        {opciones?.comunes.map((opcion) => (
          <option key={opcion.srid} value={String(opcion.srid)}>
            {opcion.etiqueta}
          </option>
        ))}
        <option value="otro">Otro EPSG…</option>
      </Selector>

      {valor === "otro" ? (
        <Campo
          etiqueta="SRID EPSG"
          type="number"
          min={1}
          max={999999}
          inputMode="numeric"
          placeholder="Por ejemplo, 3116"
          value={otro}
          error={error}
          disabled={deshabilitado}
          onChange={(evento) => onCambiarOtro(evento.target.value)}
        />
      ) : null}
    </div>
  );
}
