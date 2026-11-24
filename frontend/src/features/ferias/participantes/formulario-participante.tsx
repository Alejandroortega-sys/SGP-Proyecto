"use client";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import type { ProductoFeria } from "@/types/api";
import type {
  ErroresParticipante,
  ValoresParticipante,
} from "./validaciones-participantes";

interface FormularioParticipanteProps {
  valores: ValoresParticipante;
  errores: ErroresParticipante;
  catalogo: ProductoFeria[];
  productosPermitidos: string[];
  deshabilitado: boolean;
  enviando: boolean;
  titulo: string;
  textoBoton: string;
  onCambiar: (parcial: Partial<ValoresParticipante>) => void;
  onAlternarProducto: (id: string, marcado: boolean) => void;
  onSubmit: () => void;
  onCancelar?: () => void;
}

/** Formulario de alta o edición de un participante de la feria. */
export function FormularioParticipante({
  valores,
  errores,
  catalogo,
  productosPermitidos,
  deshabilitado,
  enviando,
  titulo,
  textoBoton,
  onCambiar,
  onAlternarProducto,
  onSubmit,
  onCancelar,
}: FormularioParticipanteProps) {
  const permitidos = new Set(productosPermitidos);
  const hayRestriccion = permitidos.size > 0;

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <h2 className="text-base font-bold text-titulo">{titulo}</h2>
        <p className="mt-1 text-sm text-texto">
          Registra el nombre del vendedor y los productos que ofrecerá en la
          feria. Si la zona tiene un catálogo, solo se permiten esos productos.
        </p>
      </div>

      <Campo
        etiqueta="Nombre del vendedor"
        requerido
        value={valores.nombre}
        maxLength={150}
        disabled={deshabilitado || enviando}
        error={errores.nombre}
        autoComplete="off"
        onChange={(evento) => onCambiar({ nombre: evento.target.value })}
      />

      <Campo
        etiqueta="Documento (opcional)"
        ayuda="Se usa para evitar vendedores duplicados en la misma feria."
        value={valores.documento}
        maxLength={30}
        disabled={deshabilitado || enviando}
        error={errores.documento}
        autoComplete="off"
        onChange={(evento) => onCambiar({ documento: evento.target.value })}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-titulo">
          Productos que venderá <span className="text-rose-600">*</span>
        </legend>
        <p className="text-sm text-tenue">
          Selecciona al menos uno. Los productos no permitidos por la zona
          aparecen deshabilitados.
        </p>
        {errores.productoIds ? (
          <Alerta tono="error">{errores.productoIds}</Alerta>
        ) : null}
        {catalogo.length === 0 ? (
          <p className="text-sm text-tenue">
            No hay productos activos en el catálogo.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {catalogo.map((producto) => {
              const permitido =
                !hayRestriccion || permitidos.has(producto.nombre);
              const marcado = valores.productoIds.includes(producto.id);
              return (
                <li key={producto.id}>
                  <label
                    className={
                      permitido
                        ? "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-white px-3 py-2 text-sm text-titulo"
                        : "flex min-h-11 cursor-not-allowed items-center gap-3 rounded-lg border border-borde bg-slate-50 px-3 py-2 text-sm text-tenue"
                    }
                  >
                    <input
                      type="checkbox"
                      className="size-5 accent-primario"
                      checked={marcado}
                      disabled={!permitido || deshabilitado || enviando}
                      onChange={(evento) =>
                        onAlternarProducto(producto.id, evento.target.checked)
                      }
                    />
                    <span>
                      {producto.nombre}
                      {!permitido ? (
                        <span className="ml-1 text-xs">
                          (no permitido en la zona)
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {errores.general ? <Alerta tono="error">{errores.general}</Alerta> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancelar ? (
          <Boton
            variante="fantasma"
            onClick={onCancelar}
            disabled={enviando}
          >
            Cancelar
          </Boton>
        ) : null}
        <Boton
          type="submit"
          cargando={enviando}
          disabled={deshabilitado || enviando}
        >
          {textoBoton}
        </Boton>
      </div>
    </form>
  );
}
