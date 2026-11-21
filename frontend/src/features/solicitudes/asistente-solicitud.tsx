"use client";

/* eslint-disable react-hooks/set-state-in-effect -- el asistente sincroniza el espacio, los requisitos y la disponibilidad con el formulario */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { useSesion } from "@/hooks/use-sesion";
import {
  comoApiError,
  consultarDisponibilidadSolicitud,
  listarProductos,
  obtenerEspacio,
  obtenerEspacios,
  obtenerRequisitosSolicitud,
  radicarSolicitud,
} from "@/lib/api-client";
import {
  guardarArchivosBorrador,
  guardarBorradorCampos,
  leerArchivosBorrador,
  leerBorradorCampos,
  limpiarBorrador,
} from "@/lib/borrador-solicitud";
import type {
  DatosRadicacionSolicitud,
  DisponibilidadSolicitud,
  RequisitoDocumental,
} from "@/types/api";
import { PasoActividad } from "./paso-actividad";
import { PasoDocumentos } from "./paso-documentos";
import { PasoHorario } from "./paso-horario";
import { PasoResumen } from "./paso-resumen";
import { PasoUbicacion } from "./paso-ubicacion";
import {
  hayErrores,
  validarPasoActividad,
  validarPasoDocumentos,
  validarPasoHorario,
  validarPasoUbicacion,
  validarSolicitudCompleta,
  type ArchivoAdjuntoSolicitud,
  type ErroresSolicitud,
} from "./validaciones-solicitud";

const PASOS = [
  { numero: 1, titulo: "Ubicación" },
  { numero: 2, titulo: "Actividad" },
  { numero: 3, titulo: "Documentos" },
  { numero: 4, titulo: "Horario" },
  { numero: 5, titulo: "Resumen" },
];

const VALORES_INICIALES: DatosRadicacionSolicitud = {
  espacioId: "",
  actividad: "",
  productoIds: [],
  fechaInicio: "",
  fechaFin: "",
  horaInicio: "",
  horaFin: "",
};

interface AsistenteSolicitudProps {
  espacioIdInicial?: string | null;
}

/** Formulario por pasos para radicar una solicitud de uso temporal. */
export function AsistenteSolicitud({
  espacioIdInicial,
}: AsistenteSolicitudProps) {
  const router = useRouter();
  const { usuario } = useSesion();

  const [paso, setPaso] = useState(1);
  const [valores, setValores] =
    useState<DatosRadicacionSolicitud>(VALORES_INICIALES);
  const [adjuntos, setAdjuntos] = useState<ArchivoAdjuntoSolicitud[]>([]);
  const [requisitos, setRequisitos] = useState<RequisitoDocumental[]>([]);
  const [cargandoRequisitos, setCargandoRequisitos] = useState(false);
  const [errores, setErrores] = useState<ErroresSolicitud>({});
  const [disponibilidad, setDisponibilidad] =
    useState<DisponibilidadSolicitud | null>(null);
  const [consultandoDisponibilidad, setConsultandoDisponibilidad] =
    useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [mensajeBorrador, setMensajeBorrador] = useState<string | null>(null);
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const [cargandoBorrador, setCargandoBorrador] = useState(true);
  const [radicando, setRadicando] = useState(false);
  const [modalDescartar, setModalDescartar] = useState(false);

  const {
    datos: espaciosData,
    cargando: cargandoEspacios,
    error: errorEspacios,
    recargar: recargarEspacios,
  } = useConsultaApi(() => obtenerEspacios({ incluirNoDisponibles: true }), []);

  const {
    datos: productosData,
    cargando: cargandoProductos,
    error: errorProductos,
    recargar: recargarProductos,
  } = useConsultaApi(listarProductos, []);

  const {
    datos: espacio,
    cargando: cargandoDetalle,
    error: errorDetalle,
    recargar: recargarDetalle,
  } = useConsultaApi(
    () =>
      valores.espacioId
        ? obtenerEspacio(valores.espacioId)
        : Promise.resolve(null),
    [valores.espacioId],
  );

  const espacios = useMemo(() => espaciosData?.datos ?? [], [espaciosData]);
  const productos = useMemo(() => productosData?.datos ?? [], [productosData]);

  const productosDisponibles = useMemo(() => {
    const permitidos = espacio?.zona?.productos ?? [];
    if (permitidos.length === 0) return productos;
    return productos.filter((producto) => permitidos.includes(producto.nombre));
  }, [productos, espacio]);

  const idsProductosPermitidos = useMemo(
    () => productosDisponibles.map((producto) => producto.id),
    [productosDisponibles],
  );

  // Restaura el borrador local al entrar al formulario.
  useEffect(() => {
    if (!usuario?.id) return;
    let activo = true;

    const cargar = async () => {
      const campos = leerBorradorCampos(usuario.id);
      const archivos = await leerArchivosBorrador(usuario.id);
      if (!activo) return;

      if (campos) {
        setValores({
          espacioId: campos.espacioId,
          actividad: campos.actividad,
          productoIds: campos.productoIds,
          fechaInicio: campos.fechaInicio,
          fechaFin: campos.fechaFin,
          horaInicio: campos.horaInicio,
          horaFin: campos.horaFin,
        });
        setPaso(campos.paso);
        setBorradorRestaurado(true);

        if (archivos.length > 0) {
          try {
            setAdjuntos(
              archivos.map((archivo) => ({
                requisitoId: archivo.requisitoId,
                archivo: new File([archivo.blob], archivo.nombre, {
                  type: archivo.tipo,
                }),
                nombre: archivo.nombre,
                tipo: archivo.tipo,
                tamano: archivo.tamano,
              })),
            );
          } catch {
            // Si el navegador no permite reconstruir el File, se vuelve a adjuntar.
          }
        }
      } else {
        // Si solo quedaron archivos sin campos, son un borrador huérfano.
        if (archivos.length > 0) await limpiarBorrador(usuario.id);
        if (espacioIdInicial) {
          setValores((actual) => ({ ...actual, espacioId: espacioIdInicial }));
        }
      }

      setCargandoBorrador(false);
    };

    void cargar();
    return () => {
      activo = false;
    };
  }, [usuario?.id, espacioIdInicial]);

  // Autoguarda los campos y archivos en el navegador.
  useEffect(() => {
    if (!usuario?.id || cargandoBorrador || radicando) return;

    const temporizador = setTimeout(() => {
      guardarBorradorCampos(usuario.id, {
        ...valores,
        paso,
        actualizadoEn: new Date().toISOString(),
      });
      void guardarArchivosBorrador(
        usuario.id,
        adjuntos.map((adjunto) => ({
          requisitoId: adjunto.requisitoId,
          nombre: adjunto.nombre,
          tipo: adjunto.tipo,
          tamano: adjunto.tamano,
          blob: adjunto.archivo,
        })),
      );
    }, 400);

    return () => clearTimeout(temporizador);
  }, [usuario?.id, cargandoBorrador, radicando, valores, adjuntos, paso]);

  // Carga los requisitos de la actividad del espacio elegido.
  useEffect(() => {
    if (!espacio) {
      setRequisitos([]);
      return;
    }

    let activo = true;
    setCargandoRequisitos(true);

    obtenerRequisitosSolicitud(espacio.actividadPermitida)
      .then((respuesta) => {
        if (!activo) return;
        setRequisitos(respuesta.requisitos);
        setAdjuntos((actuales) =>
          actuales.filter((adjunto) =>
            respuesta.requisitos.some(
              (requisito) => requisito.id === adjunto.requisitoId,
            ),
          ),
        );
      })
      .catch((error) => {
        if (activo) {
          setErrorGeneral(comoApiError(error).mensaje);
        }
      })
      .finally(() => {
        if (activo) setCargandoRequisitos(false);
      });

    return () => {
      activo = false;
    };
  }, [espacio]);

  // Verifica la disponibilidad cuando el usuario está en el paso de horario.
  useEffect(() => {
    if (paso < 4) return;

    const completo =
      valores.espacioId &&
      valores.fechaInicio &&
      valores.fechaFin &&
      valores.horaInicio &&
      valores.horaFin;

    if (!completo) {
      setDisponibilidad(null);
      setConsultandoDisponibilidad(false);
      return;
    }

    let activo = true;
    setConsultandoDisponibilidad(true);

    const temporizador = setTimeout(() => {
      consultarDisponibilidadSolicitud({
        espacioId: valores.espacioId,
        fechaInicio: valores.fechaInicio,
        fechaFin: valores.fechaFin,
        horaInicio: valores.horaInicio,
        horaFin: valores.horaFin,
      })
        .then((respuesta) => {
          if (activo) setDisponibilidad(respuesta);
        })
        .catch((error) => {
          if (!activo) return;
          const apiError = comoApiError(error);
          setDisponibilidad({
            disponible: false,
            motivo: apiError.mensaje,
            espacio: { id: valores.espacioId, nombre: espacio?.nombre ?? "" },
          });
        })
        .finally(() => {
          if (activo) setConsultandoDisponibilidad(false);
        });
    }, 350);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [
    paso,
    valores.espacioId,
    valores.fechaInicio,
    valores.fechaFin,
    valores.horaInicio,
    valores.horaFin,
    espacio?.nombre,
  ]);

  const cambiar = useCallback((parcial: Partial<DatosRadicacionSolicitud>) => {
    setValores((actual) => ({ ...actual, ...parcial }));
    setErrores({});
    setMensajeBorrador(null);
    setErrorGeneral(null);
  }, []);

  const seleccionarEspacio = useCallback((id: string) => {
    setValores((actual) => ({ ...actual, espacioId: id }));
    setErrores((actual) => ({ ...actual, espacio: undefined }));
    setMensajeBorrador(null);
  }, []);

  const adjuntar = useCallback((requisitoId: string, archivo: File) => {
    setAdjuntos((actuales) => [
      ...actuales.filter((adjunto) => adjunto.requisitoId !== requisitoId),
      {
        requisitoId,
        archivo,
        nombre: archivo.name,
        tipo: archivo.type,
        tamano: archivo.size,
      },
    ]);
    setErrores((actual) => ({ ...actual, documentos: undefined }));
    setMensajeBorrador(null);
  }, []);

  const quitarAdjunto = useCallback((requisitoId: string) => {
    setAdjuntos((actuales) =>
      actuales.filter((adjunto) => adjunto.requisitoId !== requisitoId),
    );
    setErrores((actual) => ({ ...actual, documentos: undefined }));
  }, []);

  const horario = useMemo(
    () => espacio?.horario ?? { inicio: null, fin: null },
    [espacio],
  );

  const validarPasoActual = useCallback((): boolean => {
    let nuevos: ErroresSolicitud = {};

    if (paso === 1) {
      nuevos = validarPasoUbicacion(valores);
    } else if (paso === 2) {
      nuevos = validarPasoActividad(valores, idsProductosPermitidos);
    } else if (paso === 3) {
      nuevos = validarPasoDocumentos(requisitos, adjuntos);
    } else if (paso === 4) {
      nuevos = validarPasoHorario(valores, horario, disponibilidad);
      if (consultandoDisponibilidad) {
        nuevos.disponibilidad =
          "Espera mientras verificamos la disponibilidad del espacio.";
      } else if (!disponibilidad) {
        nuevos.disponibilidad =
          "Completa las fechas y el horario para verificar la disponibilidad.";
      }
    } else {
      nuevos = validarSolicitudCompleta(
        valores,
        requisitos,
        adjuntos,
        horario,
        disponibilidad,
        idsProductosPermitidos,
      );
      if (!disponibilidad?.disponible) {
        nuevos.disponibilidad =
          disponibilidad?.motivo ??
          "Debes verificar la disponibilidad del espacio antes de radicar.";
      }
    }

    setErrores(nuevos);
    return !hayErrores(nuevos);
  }, [
    paso,
    valores,
    idsProductosPermitidos,
    requisitos,
    adjuntos,
    horario,
    disponibilidad,
    consultandoDisponibilidad,
  ]);

  const continuar = useCallback(() => {
    if (!validarPasoActual()) return;
    setPaso((actual) => Math.min(5, actual + 1));
    setErrorGeneral(null);
  }, [validarPasoActual]);

  const atras = useCallback(() => {
    setPaso((actual) => Math.max(1, actual - 1));
    setErrores({});
    setErrorGeneral(null);
  }, []);

  const guardarBorradorAhora = useCallback(() => {
    if (!usuario?.id) return;
    guardarBorradorCampos(usuario.id, {
      ...valores,
      paso,
      actualizadoEn: new Date().toISOString(),
    });
    void guardarArchivosBorrador(
      usuario.id,
      adjuntos.map((adjunto) => ({
        requisitoId: adjunto.requisitoId,
        nombre: adjunto.nombre,
        tipo: adjunto.tipo,
        tamano: adjunto.tamano,
        blob: adjunto.archivo,
      })),
    );
    setMensajeBorrador(
      "Borrador guardado en este navegador. Si cierras sesión, se eliminará.",
    );
  }, [usuario, valores, paso, adjuntos]);

  const descartarBorrador = useCallback(async () => {
    if (!usuario?.id) return;
    await limpiarBorrador(usuario.id);
    setValores(VALORES_INICIALES);
    setAdjuntos([]);
    setPaso(1);
    setErrores({});
    setDisponibilidad(null);
    setBorradorRestaurado(false);
    setMensajeBorrador("Borrador descartado.");
    setModalDescartar(false);
  }, [usuario]);

  const radicar = useCallback(async () => {
    if (!validarPasoActual()) return;

    setRadicando(true);
    setErrorGeneral(null);

    try {
      const respuesta = await radicarSolicitud(
        valores,
        adjuntos.map((adjunto) => ({
          requisitoId: adjunto.requisitoId,
          archivo: adjunto.archivo,
        })),
      );

      if (usuario?.id) {
        await limpiarBorrador(usuario.id);
      }

      router.push(
        `/comerciante/solicitudes/${respuesta.id}/confirmacion?correoEnviado=${
          respuesta.correoEnviado ? "1" : "0"
        }`,
      );
    } catch (error) {
      const apiError = comoApiError(error);
      setErrorGeneral(apiError.mensaje);

      if (apiError.status === 409) {
        setDisponibilidad({
          disponible: false,
          motivo: apiError.mensaje,
          espacio: {
            id: valores.espacioId,
            nombre: espacio?.nombre ?? "",
          },
        });
        setErrores((actual) => ({
          ...actual,
          disponibilidad: apiError.mensaje,
        }));
      }
    } finally {
      setRadicando(false);
    }
  }, [validarPasoActual, valores, adjuntos, usuario, router, espacio?.nombre]);

  if (cargandoBorrador || !usuario) {
    return <Cargando texto="Preparando el formulario de solicitud…" />;
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primario">
            Mis solicitudes
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
            Nueva solicitud de espacio
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-texto sm:text-base">
            Completa los pasos para radicar el uso temporal de un espacio
            público. Puedes guardar un borrador en este navegador y retomarlo
            después, siempre que no cierres sesión.
          </p>
        </div>

        <ol className="grid gap-2 sm:grid-cols-5" aria-label="Pasos de la solicitud">
          {PASOS.map((item) => {
            const activo = item.numero === paso;
            const completado = item.numero < paso;
            return (
              <li
                key={item.numero}
                aria-current={activo ? "step" : undefined}
                className={
                  activo
                    ? "rounded-lg border border-primario bg-primario-suave px-3 py-2 text-sm font-semibold text-primario"
                    : completado
                      ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
                      : "rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto"
                }
              >
                <span className="mr-1 font-bold">{item.numero}.</span>
                {item.titulo}
              </li>
            );
          })}
        </ol>
      </header>

      {borradorRestaurado ? (
        <Alerta tono="informacion">
          <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Recuperamos el borrador que dejaste en este navegador.</span>
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={() => setModalDescartar(true)}
            >
              Descartar borrador
            </Boton>
          </span>
        </Alerta>
      ) : null}

      {mensajeBorrador ? (
        <Alerta tono="exito" conIcono={false}>
          {mensajeBorrador}
        </Alerta>
      ) : null}

      {errorGeneral ? (
        <Alerta tono="error">
          <span className="flex flex-wrap items-start gap-2">
            <span className="flex-1">{errorGeneral}</span>
            {errorGeneral.toLowerCase().includes("conectar") ? (
              <button
                type="button"
                onClick={() => setErrorGeneral(null)}
                className="rounded border border-current px-2 py-1 text-xs font-semibold"
              >
                Cerrar
              </button>
            ) : null}
          </span>
        </Alerta>
      ) : null}

      {errorEspacios && espacios.length > 0 ? (
        <Alerta tono="advertencia">
          No se pudieron actualizar los espacios: {errorEspacios.mensaje}.{" "}
          <button
            type="button"
            onClick={recargarEspacios}
            className="font-semibold underline"
          >
            Reintentar
          </button>
        </Alerta>
      ) : null}

      {errorProductos ? (
        <Alerta tono="advertencia">
          No se pudo cargar el catálogo de productos: {errorProductos.mensaje}.{" "}
          <button
            type="button"
            onClick={recargarProductos}
            className="font-semibold underline"
          >
            Reintentar
          </button>
        </Alerta>
      ) : null}

      <div className="rounded-xl border border-borde bg-superficie p-4 sm:p-5">
        {paso === 1 ? (
          <PasoUbicacion
            espacios={espacios}
            cargandoEspacios={cargandoEspacios}
            errorEspacios={errorEspacios}
            onReintentarEspacios={recargarEspacios}
            seleccionadoId={valores.espacioId || null}
            onSeleccionar={seleccionarEspacio}
            espacio={espacio}
            cargandoDetalle={cargandoDetalle}
            errorDetalle={errorDetalle}
            onReintentarDetalle={recargarDetalle}
            errorSeleccion={errores.espacio}
          />
        ) : paso === 2 ? (
          <PasoActividad
            valores={valores}
            errores={errores}
            espacio={espacio}
            productos={productosDisponibles}
            onCambiar={cambiar}
          />
        ) : paso === 3 ? (
          <PasoDocumentos
            requisitos={requisitos}
            adjuntos={adjuntos}
            errores={errores}
            cargandoRequisitos={cargandoRequisitos}
            onAdjuntar={adjuntar}
            onQuitar={quitarAdjunto}
          />
        ) : paso === 4 ? (
          <PasoHorario
            valores={valores}
            errores={errores}
            espacio={espacio}
            disponibilidad={disponibilidad}
            consultandoDisponibilidad={consultandoDisponibilidad}
            onCambiar={cambiar}
          />
        ) : (
          <PasoResumen
            valores={valores}
            espacio={espacio}
            productos={productosDisponibles}
            requisitos={requisitos}
            adjuntos={adjuntos}
            errores={errores}
            disponibilidad={disponibilidad}
            radicando={radicando}
            onEditarPaso={setPaso}
            onRadicar={radicar}
          />
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {paso > 1 ? (
            <Boton variante="contorno" onClick={atras}>
              Atrás
            </Boton>
          ) : null}
          <Boton variante="fantasma" onClick={guardarBorradorAhora}>
            Guardar borrador
          </Boton>
        </div>

        <div className="flex flex-wrap gap-2">
          {paso < 5 ? (
            <Boton onClick={continuar} cargando={cargandoProductos && paso === 2}>
              Continuar
            </Boton>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs text-tenue">
              {radicando ? (
                <>
                  <Spinner className="size-4 text-primario" />
                  Radicando…
                </>
              ) : (
                "Revisa el resumen y radica cuando esté todo listo."
              )}
            </span>
          )}
        </div>
      </div>

      <Modal
        abierto={modalDescartar}
        titulo="Descartar borrador"
        descripcion="Se eliminarán los datos y los archivos guardados en este navegador. Esta acción no se puede deshacer."
        onCerrar={() => setModalDescartar(false)}
      >
        <AccionesModal
          onCancelar={() => setModalDescartar(false)}
          onConfirmar={() => void descartarBorrador()}
          textoConfirmar="Descartar"
          variante="peligro"
        />
      </Modal>
    </section>
  );
}
