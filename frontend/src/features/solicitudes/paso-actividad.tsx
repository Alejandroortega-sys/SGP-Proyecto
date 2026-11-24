"use client";

import { Alerta } from "@/components/ui/alerta";
import { Campo } from "@/components/ui/campo";
import type { DatosRadicacionSolicitud, EspacioDetalle, Producto } from "@/types/api";
import type { ErroresSolicitud } from "./validaciones-solicitud";

interface PasoActividadProps {
  valores: DatosRadicacionSolicitud;
  errores: ErroresSolicitud;
  espacio: EspacioDetalle | null;
  productos: Producto[];
  onCambiar: (parcial: Partial<DatosRadicacionSolicitud>) => void;
}

/** Segundo paso: actividad y productos que se venderán en el espacio. */
export function PasoActividad({
  valores,
  errores,
  espacio,
  productos,
  onCambiar,
}: PasoActividadProps) {
  const permitidos = espacio?.zona?.productos ?? [];
  const disponibles =
    permitidos.length > 0
      ? productos.filter((producto) => permitidos.includes(producto.nombre))
      : productos;

  function alternarProducto(id: string): void {
    const seleccionados = new Set(valores.productoIds);
    if (seleccionados.has(id)) {
      seleccionados.delete(id);
    } else {
      seleccionados.add(id);
    }
    onCambiar({ productoIds: [...seleccionados] });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-titulo">Actividad y productos</h2>
        <p className="mt-1 text-sm text-texto">
          Describe la actividad que realizarás y marca los productos que
          venderás. La zona puede restringir los productos permitidos.
        </p>
      </div>

      <Campo
        etiqueta="Actividad"
        requerido
        value={valores.actividad}
        error={errores.actividad}
        maxLength={200}
        placeholder="Ej. Venta de frutas y verduras"
        ayuda={
          espacio?.actividadPermitida
            ? `Actividad registrada para este espacio: ${espacio.actividadPermitida}.`
            : "Describe la actividad con tus propias palabras."
        }
        onChange={(evento) => onCambiar({ actividad: evento.target.value })}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-titulo">
          Productos <span className="text-peligro-texto">*</span>
        </legend>
        <p className="text-sm text-tenue">
          {permitidos.length > 0
            ? "Solo se muestran los productos permitidos por la zona del espacio."
            : "Selecciona los productos del catálogo municipal."}
        </p>

        {errores.productos ? (
          <p className="text-sm text-peligro-texto">{errores.productos}</p>
        ) : null}

        {disponibles.length === 0 ? (
          <Alerta tono="advertencia">
            No hay productos activos disponibles para esta zona. Contacta a la
            Secretaría de Gobierno antes de radicar.
          </Alerta>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {disponibles.map((producto) => {
              const marcado = valores.productoIds.includes(producto.id);
              return (
                <label
                  key={producto.id}
                  className={
                    marcado
                      ? "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-primario bg-primario-suave px-3 py-2 text-sm font-medium text-accent-texto"
                      : "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto hover:bg-fondo"
                  }
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternarProducto(producto.id)}
                    className="size-4 accent-primario"
                  />
                  {producto.nombre}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      {espacio?.zona ? (
        <div className="rounded-lg border border-borde bg-fondo p-3 text-sm text-texto">
          <p className="font-semibold text-titulo">Restricciones de la zona</p>
          <p className="mt-1">
            Zona {espacio.zona.nombre}. Productos permitidos:{" "}
            {espacio.zona.productos.length > 0
              ? espacio.zona.productos.join(", ")
              : "sin restricción de productos."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
