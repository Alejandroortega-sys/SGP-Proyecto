"use client";

import Link from "next/link";
import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { comoApiError, listarComerciantes } from "@/lib/api-client";
import type {
  CategoriaComercio,
  ComercianteListado,
  TitularModulo,
} from "@/types/api";
import { CampoFoto } from "./campo-foto";
import type {
  ErroresModulo,
  ModoTitular,
  ValoresModulo,
} from "./validaciones-modulo";
import {
  ETIQUETAS_CATEGORIA,
  TONO_CATEGORIA,
} from "./estilos-modulo";

interface FormularioModuloProps {
  valores: ValoresModulo;
  errores: ErroresModulo;
  foto: File | null;
  fotoActualUrl: string | null;
  titularSeleccionado: TitularModulo | null;
  onCambiar: (valores: ValoresModulo) => void;
  onCambiarFoto: (foto: File | null) => void;
  onSeleccionarTitular: (titular: TitularModulo) => void;
}

function nombreComerciante(comerciante: ComercianteListado): string {
  return [comerciante.nombre, comerciante.apellido]
    .filter(Boolean)
    .join(" ");
}

/** Formulario de censo: categoría, titular, actividad y foto. */
export function FormularioModulo({
  valores,
  errores,
  foto,
  fotoActualUrl,
  titularSeleccionado,
  onCambiar,
  onCambiarFoto,
  onSeleccionarTitular,
}: FormularioModuloProps) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ComercianteListado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  function cambiarModo(modo: ModoTitular): void {
    onCambiar({
      ...valores,
      titularModo: modo,
      titularId: modo === "registrado" ? valores.titularId : "",
      titularNombre: modo === "libre" ? valores.titularNombre : "",
    });
  }

  async function buscarTitular(): Promise<void> {
    const texto = busqueda.trim();
    if (texto.length === 0) {
      setErrorBusqueda("Escribe un nombre, correo o documento para buscar.");
      return;
    }

    setBuscando(true);
    setErrorBusqueda(null);
    try {
      const respuesta = await listarComerciantes({
        busqueda: texto,
        pagina: 1,
        limite: 10,
      });
      setResultados(respuesta.datos);
      if (respuesta.datos.length === 0) {
        setErrorBusqueda(
          "No encontramos comerciantes con ese criterio. Puedes registrar el nombre libre.",
        );
      }
    } catch (error) {
      setErrorBusqueda(comoApiError(error).mensaje);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-titulo">Datos del censo</h2>
        <p className="mt-1 text-sm text-texto">
          Completa la información del módulo o puesto. La ubicación y la zona
          se gestionan en el mapa.
        </p>
      </div>

      <Selector
        etiqueta="Categoría"
        requerido
        value={valores.categoria}
        error={errores.categoria}
        onChange={(evento) =>
          onCambiar({
            ...valores,
            categoria: evento.target.value as CategoriaComercio | "",
          })
        }
      >
        <option value="">Selecciona una categoría</option>
        <option value="formal">Formal</option>
        <option value="informal">Informal</option>
      </Selector>

      {valores.categoria ? (
        <Etiqueta tono={TONO_CATEGORIA[valores.categoria]}>
          Comercio {ETIQUETAS_CATEGORIA[valores.categoria].toLowerCase()}
        </Etiqueta>
      ) : null}

      <Campo
        etiqueta="Actividad"
        requerido
        value={valores.actividad}
        error={errores.actividad}
        maxLength={200}
        placeholder="Ej. Venta de empanadas, frutas o artesanías"
        onChange={(evento) =>
          onCambiar({ ...valores, actividad: evento.target.value })
        }
      />

      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-medium text-titulo">
            Titular <span className="text-rose-600">*</span>
          </p>
          <p className="mt-1 text-sm text-tenue">
            Puede ser un comerciante con cuenta en la plataforma o una persona
            sin cuenta.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Boton
            tamano="sm"
            variante={valores.titularModo === "registrado" ? "solido" : "contorno"}
            aria-pressed={valores.titularModo === "registrado"}
            onClick={() => cambiarModo("registrado")}
          >
            Comerciante registrado
          </Boton>
          <Boton
            tamano="sm"
            variante={valores.titularModo === "libre" ? "solido" : "contorno"}
            aria-pressed={valores.titularModo === "libre"}
            onClick={() => cambiarModo("libre")}
          >
            Titular sin cuenta
          </Boton>
        </div>

        {valores.titularModo === "registrado" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-borde bg-fondo p-3">
            {titularSeleccionado ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-titulo">
                    {titularSeleccionado.nombre}{" "}
                    {titularSeleccionado.apellido ?? ""}
                  </p>
                  <p className="text-xs text-tenue">
                    {titularSeleccionado.correo}
                  </p>
                </div>
                <Boton
                  tamano="sm"
                  variante="fantasma"
                  onClick={() =>
                    onCambiar({
                      ...valores,
                      titularId: "",
                    })
                  }
                >
                  Cambiar
                </Boton>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <Campo
                      etiqueta="Buscar comerciante"
                      value={busqueda}
                      placeholder="Nombre, correo o documento"
                      maxLength={150}
                      onChange={(evento) => setBusqueda(evento.target.value)}
                    />
                  </div>
                  <Boton
                    variante="contorno"
                    onClick={() => void buscarTitular()}
                    cargando={buscando}
                  >
                    Buscar
                  </Boton>
                </div>

                {errorBusqueda ? (
                  <p className="text-sm text-rose-700">{errorBusqueda}</p>
                ) : null}

                {resultados.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {resultados.map((comerciante) => (
                      <li key={comerciante.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSeleccionarTitular({
                              id: comerciante.id,
                              nombre: comerciante.nombre,
                              apellido: comerciante.apellido,
                              correo: comerciante.correo,
                            });
                            setResultados([]);
                          }}
                          className="w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-left text-sm hover:bg-primario-suave"
                        >
                          <span className="block font-semibold text-titulo">
                            {nombreComerciante(comerciante)}
                          </span>
                          <span className="block text-xs text-tenue">
                            {comerciante.correo}
                            {comerciante.documento
                              ? ` · ${comerciante.documento}`
                              : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}

            {errores.titular ? (
              <p className="text-sm text-rose-700">{errores.titular}</p>
            ) : null}
          </div>
        ) : (
          <Campo
            etiqueta="Nombre del titular"
            requerido
            value={valores.titularNombre}
            error={errores.titular}
            maxLength={150}
            placeholder="Ej. Nelson Mina"
            onChange={(evento) =>
              onCambiar({ ...valores, titularNombre: evento.target.value })
            }
          />
        )}
      </div>

      <CampoFoto
        foto={foto}
        fotoActualUrl={fotoActualUrl}
        error={errores.foto}
        onCambiar={onCambiarFoto}
      />

      {errores.punto ? (
        <Alerta tono="advertencia">{errores.punto}</Alerta>
      ) : null}

      {errores.advertencia ? (
        <Alerta tono="advertencia">{errores.advertencia}</Alerta>
      ) : null}

      <p className="text-xs text-tenue">
        Los campos marcados con <span className="text-rose-600">*</span> son
        obligatorios. El código del módulo se asigna automáticamente.{" "}
        <Link href="/gestor/modulos" className="font-semibold text-primario hover:underline">
          Volver al listado
        </Link>
      </p>
    </div>
  );
}
