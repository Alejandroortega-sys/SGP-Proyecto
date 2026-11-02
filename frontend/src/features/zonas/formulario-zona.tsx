"use client";

import { Alerta } from "@/components/ui/alerta";
import { Campo, Selector } from "@/components/ui/campo";
import {
  DESCRIPCIONES_TIPO,
  ETIQUETAS_TIPO,
  TIPOS_ZONA,
} from "@/features/mapa/estilos-zona";
import type { Producto, ProductoPermitido, TipoZona } from "@/types/api";
import type {
  ErroresValoresZona,
  ValoresZona,
} from "./validaciones-zona";

interface FormularioZonaProps {
  valores: ValoresZona;
  errores: ErroresValoresZona;
  productos: readonly Producto[];
  productosInactivos: readonly ProductoPermitido[];
  soloLectura: boolean;
  onCambiar: (valores: ValoresZona) => void;
}

export function FormularioZona({
  valores,
  errores,
  productos,
  productosInactivos,
  soloLectura,
  onCambiar,
}: FormularioZonaProps) {
  const productosActivos = productos.filter((producto) => producto.activo);

  function cambiar<K extends keyof ValoresZona>(
    campo: K,
    valor: ValoresZona[K],
  ): void {
    onCambiar({ ...valores, [campo]: valor });
  }

  function alternarProducto(id: string, seleccionado: boolean): void {
    const actuales = new Set(valores.productosPermitidos);
    if (seleccionado) {
      actuales.add(id);
    } else {
      actuales.delete(id);
    }
    cambiar("productosPermitidos", [...actuales]);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-titulo">Clasificación</h2>
          <p className="mt-1 text-sm text-texto">
            Define el nombre y el tipo normativo de la zona.
          </p>
        </div>

        <Campo
          etiqueta="Nombre de la zona"
          requerido
          value={valores.nombre}
          onChange={(evento) => cambiar("nombre", evento.target.value)}
          error={errores.nombre}
          ayuda="Entre 3 y 150 caracteres."
          maxLength={150}
          disabled={soloLectura}
          autoComplete="off"
        />

        <Selector
          etiqueta="Tipo de zona"
          requerido
          value={valores.tipo}
          onChange={(evento) =>
            cambiar("tipo", evento.target.value as TipoZona)
          }
          error={errores.tipo}
          disabled={soloLectura}
        >
          {TIPOS_ZONA.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETAS_TIPO[tipo]}
            </option>
          ))}
        </Selector>

        <p className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto">
          {DESCRIPCIONES_TIPO[valores.tipo]}
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-borde pt-6">
        <div>
          <h2 className="text-base font-bold text-titulo">Restricciones</h2>
          <p className="mt-1 text-sm text-texto">
            Los horarios, el aforo y los productos son opcionales. Si no los
            defines, la zona no impone esa restricción.
          </p>
        </div>

        <fieldset className="flex flex-col gap-3" disabled={soloLectura}>
          <legend className="text-sm font-medium text-titulo">
            Horario permitido
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Hora de inicio"
              type="time"
              value={valores.horarioInicio}
              onChange={(evento) =>
                cambiar("horarioInicio", evento.target.value)
              }
              ayuda="Formato HH:MM."
            />
            <Campo
              etiqueta="Hora de fin"
              type="time"
              value={valores.horarioFin}
              onChange={(evento) => cambiar("horarioFin", evento.target.value)}
              ayuda="Debe ser posterior al inicio."
            />
          </div>
          {errores.horario ? (
            <p role="alert" className="text-sm text-rose-700">
              {errores.horario}
            </p>
          ) : (
            <p className="text-sm text-tenue">
              Deja ambas horas vacías si la zona no tiene horario definido.
            </p>
          )}
        </fieldset>

        <Campo
          etiqueta="Aforo máximo"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={valores.aforoMaximo}
          onChange={(evento) =>
            cambiar("aforoMaximo", evento.target.value)
          }
          error={errores.aforo}
          ayuda="Número entero mayor que cero. Déjalo vacío para no fijar un límite propio."
          disabled={soloLectura}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-borde pt-6">
        <div>
          <h2 className="text-base font-bold text-titulo">
            Productos permitidos
          </h2>
          <p className="mt-1 text-sm text-texto">
            Selecciona los productos que se pueden vender en esta zona.
          </p>
        </div>

        {productosInactivos.length > 0 ? (
          <Alerta tono="advertencia">
            Esta zona tiene productos inactivos asociados:{" "}
            {productosInactivos.map((producto) => producto.nombre).join(", ")}.
            Si modificas la lista de productos, esas asociaciones se eliminarán.
          </Alerta>
        ) : null}

        {productosActivos.length === 0 ? (
          <p className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-tenue">
            No hay productos activos en el catálogo. Un gestor administrador
            debe crearlos o activarlos antes de asociarlos a una zona.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2" disabled={soloLectura}>
            <legend className="sr-only">Productos permitidos</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {productosActivos.map((producto) => (
                <label
                  key={producto.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primario"
                    checked={valores.productosPermitidos.includes(producto.id)}
                    onChange={(evento) =>
                      alternarProducto(producto.id, evento.target.checked)
                    }
                    disabled={soloLectura}
                  />
                  <span className="flex-1">{producto.nombre}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {errores.productos ? (
          <p role="alert" className="text-sm text-rose-700">
            {errores.productos}
          </p>
        ) : null}

        <p className="text-xs text-tenue">
          {valores.productosPermitidos.length} producto
          {valores.productosPermitidos.length === 1 ? "" : "s"} seleccionado
          {valores.productosPermitidos.length === 1 ? "" : "s"}.
        </p>
      </section>
    </div>
  );
}
