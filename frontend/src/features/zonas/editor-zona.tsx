"use client";

/* eslint-disable react-hooks/set-state-in-effect -- la carga se reinicia al cambiar de zona o al reintentar */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import { useSesion } from "@/hooks/use-sesion";
import {
  actualizarZona,
  ApiError,
  comoApiError,
  crearZona,
  listarProductos,
  obtenerZona,
  obtenerZonasGeoJson,
} from "@/lib/api-client";
import type {
  Producto,
  ZonaDetalle,
} from "@/types/api";
import { FormularioZona } from "./formulario-zona";
import {
  desdeGeoJsonPoligono,
  poligonosDesdeZonas,
  poligonosIguales,
  validarGeometriaZona,
  type Punto,
  type PoligonoZona,
} from "./geometria-zona";
import { MapaEditorZonaCarga } from "./mapa-editor-zona-carga";
import {
  construirCuerpoActualizacion,
  construirCuerpoCreacion,
  tieneErrores,
  validarValoresZona,
  valoresDesdeZona,
  valoresIniciales,
  type ErroresValoresZona,
  type ValoresZona,
} from "./validaciones-zona";

interface EditorZonaProps {
  id?: string;
  mensajeInicial?: string;
}

function listaErrores(errores: ErroresValoresZona): string[] {
  return Object.values(errores).filter((error): error is string =>
    Boolean(error),
  );
}

export function EditorZona({ id, mensajeInicial }: EditorZonaProps) {
  const router = useRouter();
  const { usuario, cargando: cargandoSesion } = useSesion();
  const esAdministrador = usuario?.perfil === "administrador";
  const soloLectura = !esAdministrador;

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<ApiError | null>(null);
  const [versionCarga, setVersionCarga] = useState(0);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [zonas, setZonas] = useState<PoligonoZona[]>([]);
  const [zona, setZona] = useState<ZonaDetalle | null>(null);

  const [valores, setValores] = useState<ValoresZona>(valoresIniciales);
  const [valoresInicialesZona, setValoresInicialesZona] =
    useState<ValoresZona>(valoresIniciales);
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [cerrado, setCerrado] = useState(false);

  const [errores, setErrores] = useState<ErroresValoresZona>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(mensajeInicial ?? null);

  // Carga catálogo, contexto activo y detalle de la zona.
  useEffect(() => {
    let activo = true;
    setCargando(true);
    setErrorCarga(null);

    Promise.all([
      listarProductos(),
      obtenerZonasGeoJson(),
      id ? obtenerZona(id) : Promise.resolve(null),
    ])
      .then(([respuestaProductos, geojson, detalle]) => {
        if (!activo) return;

        setProductos(respuestaProductos.datos);
        setZonas(poligonosDesdeZonas(geojson.features, id));

        if (detalle) {
          const iniciales = valoresDesdeZona(detalle);
          setZona(detalle);
          setValores(iniciales);
          setValoresInicialesZona(iniciales);
          setPuntos(desdeGeoJsonPoligono(detalle.geometria));
          setCerrado(true);
        } else {
          setZona(null);
          setValores(valoresIniciales());
          setValoresInicialesZona(valoresIniciales());
          setPuntos([]);
          setCerrado(false);
        }
      })
      .catch((capturado) => {
        if (activo) setErrorCarga(comoApiError(capturado));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [id, versionCarga]);

  const resultadoGeometria = useMemo(() => {
    if (!cerrado) {
      return {
        valido: false,
        errores: [
          "Cierra el polígono para validar su topología y sus solapes.",
        ],
        conflicto: null,
      };
    }
    return validarGeometriaZona(puntos, zonas, id);
  }, [cerrado, puntos, zonas, id]);

  const geometriaCambiada = useMemo(
    () => (zona ? !poligonosIguales(puntos, zona.geometria) : true),
    [puntos, zona],
  );

  const cuerpoEdicion = useMemo(() => {
    if (!id) return null;
    return construirCuerpoActualizacion(
      valores,
      valoresInicialesZona,
      puntos,
      geometriaCambiada,
    );
  }, [id, valores, valoresInicialesZona, puntos, geometriaCambiada]);

  const hayCambios = id
    ? Boolean(cuerpoEdicion && Object.keys(cuerpoEdicion).length > 0)
    : true;

  const productosInactivos =
    zona?.productosPermitidos.filter((producto) => !producto.activo) ?? [];

  const zonaOriginal = useMemo(
    () => (zona ? desdeGeoJsonPoligono(zona.geometria) : null),
    [zona],
  );

  function limpiarAvisos(): void {
    setExito(null);
    setErrorGuardado(null);
  }

  function actualizarValores(nuevos: ValoresZona): void {
    setValores(nuevos);
    setErrores({});
    limpiarAvisos();
  }

  function agregarPunto(punto: Punto): void {
    setPuntos((actuales) => [...actuales, punto]);
    setCerrado(false);
    limpiarAvisos();
  }

  function moverPunto(indice: number, punto: Punto): void {
    setPuntos((actuales) =>
      actuales.map((actual, posicion) =>
        posicion === indice ? punto : actual,
      ),
    );
    limpiarAvisos();
  }

  function quitarPunto(indice: number): void {
    setPuntos((actuales) => {
      const siguientes = actuales.filter((_, posicion) => posicion !== indice);
      if (siguientes.length < 3) setCerrado(false);
      return siguientes;
    });
    limpiarAvisos();
  }

  function deshacer(): void {
    setPuntos((actuales) => actuales.slice(0, -1));
    setCerrado(false);
    limpiarAvisos();
  }

  function borrar(): void {
    setPuntos([]);
    setCerrado(false);
    limpiarAvisos();
  }

  function cerrar(): void {
    if (puntos.length < 3) return;
    setCerrado(true);
    limpiarAvisos();
  }

  function reabrir(): void {
    setCerrado(false);
    limpiarAvisos();
  }

  async function guardar(): Promise<void> {
    if (guardando || soloLectura) return;

    limpiarAvisos();
    const erroresValores = validarValoresZona(valores, productos);
    setErrores(erroresValores);

    if (
      tieneErrores(erroresValores) ||
      !cerrado ||
      !resultadoGeometria.valido
    ) {
      return;
    }

    setGuardando(true);
    try {
      if (!id) {
        const creada = await crearZona(
          construirCuerpoCreacion(valores, puntos),
        );
        router.replace(`/gestor/zonas/${creada.id}/editar?guardada=1`);
        return;
      }

      if (!cuerpoEdicion || Object.keys(cuerpoEdicion).length === 0) {
        setExito("No hay cambios para guardar.");
        return;
      }

      const actualizada = await actualizarZona(id, cuerpoEdicion);
      const nuevosValores = valoresDesdeZona(actualizada);
      setZona(actualizada);
      setValores(nuevosValores);
      setValoresInicialesZona(nuevosValores);
      setPuntos(desdeGeoJsonPoligono(actualizada.geometria));
      setCerrado(true);
      setExito("Los cambios se guardaron correctamente.");

      try {
        const geojson = await obtenerZonasGeoJson();
        setZonas(poligonosDesdeZonas(geojson.features, id));
      } catch {
        // La zona ya se guardó; el contexto se actualizará al recargar.
      }
    } catch (capturado) {
      setErrorGuardado(comoApiError(capturado));
    } finally {
      setGuardando(false);
    }
  }

  if (cargandoSesion || cargando) {
    return (
      <Cargando
        texto={id ? "Cargando la zona…" : "Preparando el editor de zonas…"}
      />
    );
  }

  if (errorCarga) {
    if (errorCarga.status === 404) {
      return (
        <EstadoVacio
          titulo="La zona solicitada no existe"
          descripcion="Puede que haya sido eliminada o que el identificador no sea válido."
          accion={
            <Link
              href="/gestor/zonas"
              className="font-semibold text-primario hover:underline"
            >
              Volver al listado de zonas
            </Link>
          }
        />
      );
    }

    return (
      <BloqueError
        error={errorCarga}
        onReintentar={() => setVersionCarga((valor) => valor + 1)}
      />
    );
  }

  if (!esAdministrador && !id) {
    return (
      <div className="flex flex-col gap-6">
        <EncabezadoEditor id={id} esAdministrador={false} />
        <EstadoVacio
          titulo="Solo el administrador puede crear zonas"
          descripcion="Tu perfil de revisor permite consultar las zonas existentes, pero no crear ni modificar su geometría, clasificación o restricciones."
          accion={
            <Link
              href="/gestor/zonas"
              className="font-semibold text-primario hover:underline"
            >
              Volver al listado de zonas
            </Link>
          }
        />
      </div>
    );
  }

  const erroresValores = listaErrores(errores);
  const puedeGuardar =
    !soloLectura &&
    cerrado &&
    resultadoGeometria.valido &&
    !tieneErrores(errores) &&
    (id ? hayCambios : true);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoEditor id={id} esAdministrador={esAdministrador} />

      {exito ? (
        <Alerta tono="exito">
          <span className="flex flex-col gap-2">
            <span>{exito}</span>
            <span className="flex flex-wrap gap-3 text-sm">
              <Link href="/mapa" className="font-semibold underline">
                Ver el mapa público
              </Link>
              <Link href="/gestor/zonas" className="font-semibold underline">
                Volver al listado
              </Link>
            </span>
          </span>
        </Alerta>
      ) : null}

      {soloLectura ? (
        <Alerta tono="informacion">
          Estás viendo la zona en modo lectura. Solo el gestor administrador
          puede modificar la geometría, la clasificación o las restricciones.
        </Alerta>
      ) : null}

      {errorGuardado ? (
        <Alerta tono="error">
          <span className="flex flex-col gap-1">
            <span className="font-semibold">
              No se pudo guardar la zona
            </span>
            <span>{errorGuardado.mensaje}</span>
          </span>
        </Alerta>
      ) : null}

      {erroresValores.length > 0 ? (
        <Alerta tono="error">
          <span className="flex flex-col gap-1">
            <span className="font-semibold">
              Revisa los campos del formulario
            </span>
            {erroresValores.map((error) => (
              <span key={error}>• {error}</span>
            ))}
          </span>
        </Alerta>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-w-0 flex-col gap-4">
          <MapaEditorZonaCarga
            puntos={puntos}
            cerrado={cerrado}
            tipo={valores.tipo}
            zonas={zonas}
            zonaOriginal={zonaOriginal}
            conflicto={resultadoGeometria.conflicto}
            esEdicion={Boolean(id)}
            soloLectura={soloLectura}
            onAgregarPunto={agregarPunto}
            onMoverPunto={moverPunto}
            onQuitarPunto={quitarPunto}
            onDeshacer={deshacer}
            onBorrar={borrar}
            onCerrar={cerrar}
            onReabrir={reabrir}
          />

          <Tarjeta>
            <TarjetaCuerpo className="flex flex-col gap-3">
              <h2 className="text-base font-bold text-titulo">
                Validación de la geometría
              </h2>
              {resultadoGeometria.valido ? (
                <Alerta tono="exito">
                  La geometría es válida y no se solapa con ninguna zona activa.
                </Alerta>
              ) : (
                <Alerta
                  tono={cerrado ? "error" : "advertencia"}
                >
                  <span className="flex flex-col gap-1">
                    {resultadoGeometria.errores.map((error) => (
                      <span key={error}>• {error}</span>
                    ))}
                  </span>
                </Alerta>
              )}
              <p className="text-xs leading-relaxed text-tenue">
                La validación del navegador es una ayuda inmediata. Al guardar,
                PostGIS vuelve a comprobar la topología y los solapes; si algo
                no cumple, el backend rechaza la operación con un mensaje
                explicativo.
              </p>
              {zona ? (
                <p className="text-xs text-tenue">
                  Última actualización:{" "}
                  {new Date(zona.actualizadoEn).toLocaleString("es-CO")}
                </p>
              ) : null}
            </TarjetaCuerpo>
          </Tarjeta>

          {!soloLectura ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link
                href="/gestor/zonas"
                className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-texto hover:bg-slate-100"
              >
                Cancelar
              </Link>
              <Boton
                onClick={() => void guardar()}
                cargando={guardando}
                disabled={!puedeGuardar}
              >
                {id ? "Guardar cambios" : "Crear zona"}
              </Boton>
            </div>
          ) : null}

          {id && !soloLectura && !hayCambios ? (
            <p className="text-right text-xs text-tenue">
              No hay cambios pendientes.
            </p>
          ) : null}
        </div>

        <Tarjeta>
          <TarjetaCuerpo>
            <FormularioZona
              valores={valores}
              errores={errores}
              productos={productos}
              productosInactivos={productosInactivos}
              soloLectura={soloLectura}
              onCambiar={actualizarValores}
            />
          </TarjetaCuerpo>
        </Tarjeta>
      </div>
    </div>
  );
}

function EncabezadoEditor({
  id,
  esAdministrador,
}: {
  id?: string;
  esAdministrador: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/gestor/zonas"
        className="text-sm font-semibold text-primario hover:underline"
      >
        ← Volver al listado de zonas
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primario">
            Gestión del espacio público
          </p>
          <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
            {id ? "Editar zona" : "Delimitar y clasificar una zona"}
          </h1>
          <p className="mt-2 max-w-3xl text-base text-texto">
            Dibuja el polígono sobre el mapa, clasifícalo y define sus
            restricciones. Los cambios se publican en el mapa ciudadano.
          </p>
        </div>
        {!esAdministrador ? (
          <span className="rounded-full border border-borde bg-fondo px-3 py-1 text-xs font-semibold text-tenue">
            Modo lectura
          </span>
        ) : null}
      </div>
    </div>
  );
}
