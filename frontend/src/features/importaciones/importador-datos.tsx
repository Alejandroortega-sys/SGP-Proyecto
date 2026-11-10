"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { useSesion } from "@/hooks/use-sesion";
import {
  ApiError,
  comoApiError,
  confirmarImportacionModulos,
  confirmarImportacionZonas,
  descargarReporteImportacion,
  obtenerSridsImportacion,
  previsualizarImportacionModulos,
  previsualizarImportacionZonas,
} from "@/lib/api-client";
import type {
  ConfirmacionImportacion,
  PrevisualizacionImportacion,
  TipoImportacion,
} from "@/types/api";
import {
  DESCRIPCION_TIPO_IMPORTACION,
  ETIQUETAS_TIPO_IMPORTACION,
} from "./estilos-importacion";
import { MapaPrevisualizacionCarga } from "./mapa-previsualizacion-carga";
import { PanelReporte } from "./panel-reporte";
import { PasosImportacion } from "./pasos-importacion";
import { ResumenPrevisualizacion } from "./resumen-previsualizacion";
import { SelectorArchivo } from "./selector-archivo";
import { SelectorSrid } from "./selector-srid";
import { TablaPrevisualizacion } from "./tabla-previsualizacion";
import {
  crearPlantillaCsvModulos,
  crearPlantillaGeoJsonZonas,
  validarArchivoImportacion,
} from "./validaciones-importacion";

function descargarBlob(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/** Pantalla completa del flujo de importación (HU-14). */
export function ImportadorDatos() {
  const { usuario, cargando } = useSesion();
  const srids = useConsultaApi(obtenerSridsImportacion, []);

  const [tipo, setTipo] = useState<TipoImportacion>("zonas");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [sridSeleccion, setSridSeleccion] = useState("auto");
  const [sridOtro, setSridOtro] = useState("");
  const [errorSrid, setErrorSrid] = useState<string | null>(null);

  const [preview, setPreview] = useState<PrevisualizacionImportacion | null>(
    null,
  );
  const [confirmacion, setConfirmacion] =
    useState<ConfirmacionImportacion | null>(null);
  const [aceptaAdvertencia, setAceptaAdvertencia] = useState(false);

  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<ApiError | null>(null);

  if (cargando) return <Cargando texto="Cargando la sesión…" />;
  if (!usuario) return null;

  const esAdministrador = usuario.perfil === "administrador";
  const tipoEfectivo: TipoImportacion = esAdministrador ? tipo : "modulos";
  const pasoActual = confirmando
    ? 3
    : confirmacion
      ? 4
      : preview
        ? 2
        : 1;
  const requiereConfirmacion =
    preview?.filas.some((fila) => fila.requiereConfirmacion) ?? false;
  const puedeConfirmar = preview !== null && !confirmando;

  function limpiarResultado(): void {
    setPreview(null);
    setConfirmacion(null);
    setErrorAccion(null);
    setErrorSrid(null);
    setAceptaAdvertencia(false);
  }

  function cambiarTipo(nuevo: TipoImportacion): void {
    if (nuevo === tipoEfectivo) return;
    setTipo(nuevo);
    setArchivo(null);
    setErrorArchivo(null);
    setSridSeleccion("auto");
    setSridOtro("");
    limpiarResultado();
  }

  function seleccionarArchivo(nuevo: File | null): void {
    setArchivo(nuevo);
    setErrorArchivo(
      nuevo ? validarArchivoImportacion(nuevo, tipoEfectivo) : null,
    );
    limpiarResultado();
  }

  function reiniciar(): void {
    setArchivo(null);
    setErrorArchivo(null);
    setSridSeleccion("auto");
    setSridOtro("");
    limpiarResultado();
  }

  function sridParaEnviar(): number | undefined | null {
    if (tipoEfectivo !== "zonas" || sridSeleccion === "auto") return undefined;

    const valor =
      sridSeleccion === "otro" ? Number(sridOtro) : Number(sridSeleccion);

    if (!Number.isInteger(valor) || valor <= 0 || valor > 999999) {
      setErrorSrid("Escribe un SRID EPSG válido (entero positivo).");
      return null;
    }

    setErrorSrid(null);
    return valor;
  }

  async function previsualizar(): Promise<void> {
    if (cargandoPreview) return;

    const error = validarArchivoImportacion(archivo, tipoEfectivo);
    setErrorArchivo(error);
    if (error || !archivo) return;

    const srid = sridParaEnviar();
    if (srid === null) return;

    setCargandoPreview(true);
    setErrorAccion(null);
    setPreview(null);
    setConfirmacion(null);
    setAceptaAdvertencia(false);

    try {
      const respuesta =
        tipoEfectivo === "zonas"
          ? await previsualizarImportacionZonas(archivo, srid)
          : await previsualizarImportacionModulos(archivo);
      setPreview(respuesta);
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setCargandoPreview(false);
    }
  }

  async function confirmar(): Promise<void> {
    if (!preview || confirmando) return;

    setConfirmando(true);
    setErrorAccion(null);

    try {
      const respuesta =
        tipoEfectivo === "zonas"
          ? await confirmarImportacionZonas(preview.token)
          : await confirmarImportacionModulos(
              preview.token,
              aceptaAdvertencia,
            );
      setConfirmacion(respuesta);
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setConfirmando(false);
    }
  }

  async function descargarReporte(): Promise<void> {
    if (!confirmacion || descargando) return;

    setDescargando(true);
    setErrorAccion(null);

    try {
      const { blob, nombreArchivo } = await descargarReporteImportacion(
        confirmacion.token,
      );
      descargarBlob(blob, nombreArchivo);
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setDescargando(false);
    }
  }

  function descargarPlantilla(): void {
    if (tipoEfectivo === "zonas") {
      descargarBlob(
        new Blob([crearPlantillaGeoJsonZonas()], {
          type: "application/geo+json;charset=utf-8",
        }),
        "plantilla-zonas.geojson",
      );
      return;
    }

    descargarBlob(
      new Blob([crearPlantillaCsvModulos()], {
        type: "text/csv;charset=utf-8",
      }),
      "plantilla-modulos.csv",
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primario">
          Gestión del territorio
        </p>
        <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
          Importar zonas y módulos
        </h1>
        <p className="mt-2 max-w-3xl text-base text-texto">
          Carga un archivo, revisa la previsualización sobre el mapa y confirma
          solo los registros válidos. Las filas rechazadas quedan en un reporte
          descargable.
        </p>
      </div>

      <PasosImportacion pasoActual={pasoActual} />

      {!preview && !confirmacion ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <div
              role="tablist"
              aria-label="Tipo de importación"
              className="flex flex-wrap gap-2"
            >
              {(esAdministrador
                ? (["zonas", "modulos"] as const)
                : (["modulos"] as const)
              ).map((opcion) => {
                const activo = opcion === tipoEfectivo;
                return (
                  <button
                    key={opcion}
                    type="button"
                    role="tab"
                    aria-selected={activo}
                    onClick={() => cambiarTipo(opcion)}
                    className={[
                      "min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold",
                      activo
                        ? "border-primario bg-primario-suave text-primario"
                        : "border-borde bg-white text-texto hover:bg-fondo",
                    ].join(" ")}
                  >
                    {ETIQUETAS_TIPO_IMPORTACION[opcion]}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 max-w-3xl text-sm text-texto">
              {DESCRIPCION_TIPO_IMPORTACION[tipoEfectivo]}
            </p>
          </TarjetaEncabezado>

          <TarjetaCuerpo className="flex flex-col gap-5">
            {errorAccion ? (
              <Alerta tono="error">{errorAccion.mensaje}</Alerta>
            ) : null}

            <SelectorArchivo
              tipo={tipoEfectivo}
              archivo={archivo}
              error={errorArchivo}
              deshabilitado={cargandoPreview}
              onCambiar={seleccionarArchivo}
            />

            {tipoEfectivo === "zonas" ? (
              <SelectorSrid
                opciones={srids.datos}
                valor={sridSeleccion}
                otro={sridOtro}
                error={errorSrid}
                deshabilitado={cargandoPreview}
                onCambiar={(valor) => {
                  setSridSeleccion(valor);
                  setErrorSrid(null);
                }}
                onCambiarOtro={(valor) => {
                  setSridOtro(valor);
                  setErrorSrid(null);
                }}
              />
            ) : null}

            <details className="rounded-lg border border-borde bg-fondo p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-titulo">
                Formato esperado del archivo
              </summary>
              {tipoEfectivo === "zonas" ? (
                <div className="mt-3 space-y-1 text-texto">
                  <p>
                    FeatureCollection con geometrías <strong>Polygon</strong>.
                    No se admiten MultiPolygon.
                  </p>
                  <p>
                    Propiedades obligatorias: <strong>nombre</strong> y{" "}
                    <strong>tipo</strong>.
                  </p>
                  <p>
                    Opcionales: horarioInicio, horarioFin, aforoMaximo y
                    productosPermitidos (nombres separados por punto y coma).
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-1 text-texto">
                  <p>
                    Encabezados obligatorios: categoria, actividad, latitud y
                    longitud.
                  </p>
                  <p>
                    Titular: exactamente uno de titular_documento (comerciante
                    registrado) o titular_nombre (nombre libre).
                  </p>
                  <p>
                    Se aceptan coma o punto y coma como delimitador y coma
                    decimal cuando el delimitador es punto y coma.
                  </p>
                </div>
              )}
              <Boton
                variante="contorno"
                tamano="sm"
                className="mt-3"
                onClick={descargarPlantilla}
              >
                Descargar plantilla
              </Boton>
            </details>

            {srids.error && tipoEfectivo === "zonas" ? (
              <p className="text-xs text-tenue">
                No se pudieron cargar las opciones de SRID. Puedes escribir el
                EPSG manualmente.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Boton
                onClick={() => void previsualizar()}
                cargando={cargandoPreview}
                disabled={!archivo || Boolean(errorArchivo)}
              >
                Previsualizar archivo
              </Boton>
              {archivo ? (
                <Boton variante="fantasma" onClick={reiniciar}>
                  Cancelar
                </Boton>
              ) : null}
            </div>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : null}

      {preview && !confirmacion ? (
        <div className="flex flex-col gap-4">
          <ResumenPrevisualizacion preview={preview} />

          <MapaPrevisualizacionCarga tipo={preview.tipo} filas={preview.filas} />

          <Tarjeta>
            <TarjetaEncabezado className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-titulo">
                  Filas de la previsualización
                </h2>
                <p className="mt-1 text-sm text-texto">
                  Revisa los datos y los motivos antes de confirmar.
                </p>
              </div>
              <p className="text-xs text-tenue">
                Token válido hasta{" "}
                {new Date(preview.expiraEn).toLocaleTimeString("es-CO")}
              </p>
            </TarjetaEncabezado>
            <TablaPrevisualizacion
              tipo={preview.tipo}
              filas={preview.filas}
            />
          </Tarjeta>

          <Tarjeta>
            <TarjetaCuerpo className="flex flex-col gap-4">
              {errorAccion ? (
                <Alerta tono="error">{errorAccion.mensaje}</Alerta>
              ) : null}

              {requiereConfirmacion ? (
                <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    checked={aceptaAdvertencia}
                    onChange={(evento) =>
                      setAceptaAdvertencia(evento.target.checked)
                    }
                    className="mt-0.5 size-5 shrink-0 rounded border-amber-400"
                  />
                  <span>
                    Confirmo importar las filas ubicadas en zona restringida. Si
                    no marcas esta casilla, esas filas se rechazarán y quedarán
                    en el reporte.
                  </span>
                </label>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Boton
                  onClick={() => void confirmar()}
                  cargando={confirmando}
                  disabled={!puedeConfirmar}
                >
                  Confirmar importación
                </Boton>
                <Boton
                  variante="contorno"
                  onClick={reiniciar}
                  disabled={confirmando}
                >
                  Cancelar previsualización
                </Boton>
              </div>

              {preview.resumen.validas === 0 ? (
                <Alerta tono="advertencia">
                  No hay filas válidas para importar. Si confirmas, no se
                  creará ningún registro y podrás descargar el reporte con los
                  motivos de rechazo.
                </Alerta>
              ) : null}
            </TarjetaCuerpo>
          </Tarjeta>
        </div>
      ) : null}

      {confirmacion ? (
        <PanelReporte
          confirmacion={confirmacion}
          tipo={tipoEfectivo}
          descargando={descargando}
          error={errorAccion}
          onDescargar={() => void descargarReporte()}
          onReiniciar={reiniciar}
        />
      ) : null}
    </div>
  );
}
