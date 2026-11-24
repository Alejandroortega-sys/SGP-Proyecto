"use client";

import Link from "next/link";
import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { AccionesModal, Modal } from "@/components/ui/modal";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { EtiquetaEstadoFeria } from "@/features/ferias/etiqueta-estado-feria";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  actualizarParticipanteFeria,
  comoApiError,
  crearParticipanteFeria,
  eliminarParticipanteFeria,
  enviarListadoParticipantes,
  listarParticipantesFeria,
} from "@/lib/api-client";
import { formatearFechaHora } from "@/lib/formato";
import type { ParticipanteFeria } from "@/types/api";
import { FormularioParticipante } from "./formulario-participante";
import { ListaParticipantes } from "./lista-participantes";
import {
  FORMULARIO_PARTICIPANTE_VACIO,
  puedeEnviarListado,
  sinErroresParticipante,
  validarFormularioParticipante,
  type ErroresParticipante,
  type ValoresParticipante,
} from "./validaciones-participantes";

/** Gestión de participantes de una feria propia (HU-23). */
export function GestionParticipantes({ feriaId }: { feriaId: string }) {
  const { datos, cargando, error, recargar } = useConsultaApi(
    () => listarParticipantesFeria(feriaId),
    [feriaId],
  );

  const [valores, setValores] = useState<ValoresParticipante>(
    FORMULARIO_PARTICIPANTE_VACIO,
  );
  const [errores, setErrores] = useState<ErroresParticipante>({});
  const [creando, setCreando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [editando, setEditando] = useState<ParticipanteFeria | null>(null);
  const [valoresEdicion, setValoresEdicion] = useState<ValoresParticipante>(
    FORMULARIO_PARTICIPANTE_VACIO,
  );
  const [erroresEdicion, setErroresEdicion] = useState<ErroresParticipante>(
    {},
  );
  const [guardando, setGuardando] = useState(false);

  const [retirando, setRetirando] = useState<ParticipanteFeria | null>(null);
  const [retirandoCargando, setRetirandoCargando] = useState(false);

  const [confirmarEnvio, setConfirmarEnvio] = useState(false);
  const [enviandoListado, setEnviandoListado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  if (cargando && datos === null) {
    return <Cargando texto="Consultando los participantes…" />;
  }

  if (error) {
    return <BloqueError error={error} onReintentar={recargar} />;
  }

  if (!datos) return null;

  const productosPermitidos = datos.productosPermitidos.map(
    (producto) => producto.nombre,
  );
  const gestionable =
    datos.feria.estado === "aprobada" && !datos.listadoFinal.enviado;
  const bloqueado = !gestionable;
  const puedeAgregar = gestionable && !datos.cupo.completo;
  const puedeEnviar = puedeEnviarListado(
    datos.listadoFinal.enviado,
    datos.participantes.length,
  );

  function cambiar(parcial: Partial<ValoresParticipante>) {
    setValores((actual) => ({ ...actual, ...parcial }));
    setErrores((actual) => {
      const siguiente = { ...actual };
      for (const clave of Object.keys(parcial) as (keyof ValoresParticipante)[]) {
        delete siguiente[clave];
      }
      delete siguiente.general;
      return siguiente;
    });
  }

  function alternarProducto(id: string, marcado: boolean) {
    setValores((actual) => ({
      ...actual,
      productoIds: marcado
        ? [...new Set([...actual.productoIds, id])]
        : actual.productoIds.filter((item) => item !== id),
    }));
    setErrores((actual) => {
      const siguiente = { ...actual };
      delete siguiente.productoIds;
      return siguiente;
    });
  }

  function cambiarEdicion(parcial: Partial<ValoresParticipante>) {
    setValoresEdicion((actual) => ({ ...actual, ...parcial }));
    setErroresEdicion((actual) => {
      const siguiente = { ...actual };
      for (const clave of Object.keys(parcial) as (keyof ValoresParticipante)[]) {
        delete siguiente[clave];
      }
      return siguiente;
    });
  }

  function alternarProductoEdicion(id: string, marcado: boolean) {
    setValoresEdicion((actual) => ({
      ...actual,
      productoIds: marcado
        ? [...new Set([...actual.productoIds, id])]
        : actual.productoIds.filter((item) => item !== id),
    }));
    setErroresEdicion((actual) => {
      const siguiente = { ...actual };
      delete siguiente.productoIds;
      return siguiente;
    });
  }

  function abrirEdicion(participante: ParticipanteFeria) {
    setEditando(participante);
    setValoresEdicion({
      nombre: participante.nombre,
      documento: participante.documento ?? "",
      productoIds: participante.productos.map((producto) => producto.id),
    });
    setErroresEdicion({});
  }

  async function crear() {
    if (!datos || creando) return;
    const validacion = validarFormularioParticipante(valores, {
      catalogo: datos.productosCatalogo,
      productosPermitidos,
      cupo: datos.cupo,
      esEdicion: false,
    });

    setErrores(validacion);
    if (!sinErroresParticipante(validacion)) return;

    setCreando(true);
    setErrorAccion(null);
    setExito(null);

    try {
      await crearParticipanteFeria(feriaId, {
        nombre: valores.nombre.trim(),
        documento: valores.documento.trim() || null,
        productoIds: valores.productoIds,
      });
      setValores(FORMULARIO_PARTICIPANTE_VACIO);
      setErrores({});
      setExito("Participante agregado correctamente.");
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado).message);
    } finally {
      setCreando(false);
    }
  }

  async function guardarEdicion() {
    if (!datos || !editando || guardando) return;
    const validacion = validarFormularioParticipante(valoresEdicion, {
      catalogo: datos.productosCatalogo,
      productosPermitidos,
      cupo: datos.cupo,
      esEdicion: true,
    });

    setErroresEdicion(validacion);
    if (!sinErroresParticipante(validacion)) return;

    setGuardando(true);
    setErrorAccion(null);
    setExito(null);

    try {
      await actualizarParticipanteFeria(feriaId, editando.id, {
        nombre: valoresEdicion.nombre.trim(),
        documento: valoresEdicion.documento.trim() || null,
        productoIds: valoresEdicion.productoIds,
      });
      setEditando(null);
      setExito("Participante actualizado correctamente.");
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado).message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarRetiro() {
    if (!retirando || retirandoCargando) return;
    setRetirandoCargando(true);
    setErrorAccion(null);
    setExito(null);

    try {
      await eliminarParticipanteFeria(feriaId, retirando.id);
      setRetirando(null);
      setExito(
        "Participante retirado. El cupo volvió a estar disponible.",
      );
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado).message);
    } finally {
      setRetirandoCargando(false);
    }
  }

  async function enviarListado() {
    if (enviandoListado) return;
    setEnviandoListado(true);
    setErrorEnvio(null);

    try {
      await enviarListadoParticipantes(feriaId);
      setConfirmarEnvio(false);
      setExito("Listado final enviado correctamente. Ya no se puede modificar.");
      recargar();
    } catch (capturado) {
      setErrorEnvio(comoApiError(capturado).message);
    } finally {
      setEnviandoListado(false);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <Link
          href={`/organizador/ferias/${feriaId}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-texto hover:underline"
        >
          ← Volver al detalle de la feria
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
            Portal del organizador
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              Participantes de la feria
            </h1>
            <EtiquetaEstadoFeria estado={datos.feria.estado} />
            {datos.listadoFinal.enviado ? (
              <Etiqueta tono="exitoso">Listado final enviado</Etiqueta>
            ) : (
              <Etiqueta tono="pendiente">Listado en borrador</Etiqueta>
            )}
          </div>
          <p className="mt-2 text-sm font-semibold text-accent-texto">
            {datos.feria.numeroRadicado} · {datos.feria.nombre}
          </p>
          <p className="mt-1 text-sm text-texto">
            {datos.feria.zona.nombre} ·{" "}
            {formatearRangoFechas(
              datos.feria.fechaInicio,
              datos.feria.fechaFin,
            )}{" "}
            · {datos.feria.numeroPuestos} puestos
          </p>
        </div>
      </header>

      {datos.feria.estado !== "aprobada" ? (
        <Alerta tono="advertencia">
          <p className="font-semibold">La feria no está aprobada.</p>
          <p className="mt-1">
            Solo se pueden registrar o modificar participantes cuando el gestor
            aprueba la feria.
          </p>
        </Alerta>
      ) : null}

      {datos.listadoFinal.enviado ? (
        <Alerta tono="exito">
          <p className="font-semibold">Listado final enviado.</p>
          <p className="mt-1">
            Enviado el {formatearFechaHora(datos.listadoFinal.enviadoEn)}. El
            gestor ya puede consultar esta lista y no admite cambios.
          </p>
        </Alerta>
      ) : null}

      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}
      {errorAccion ? <Alerta tono="error">{errorAccion}</Alerta> : null}

      <Tarjeta>
        <TarjetaEncabezado>
          <h2 className="text-base font-bold text-titulo">Cupo de la feria</h2>
        </TarjetaEncabezado>
        <TarjetaCuerpo className="flex flex-col gap-3">
          <p className="text-sm text-texto" role="status">
            {datos.cupo.ocupados} de {datos.cupo.aprobado} participantes
            registrados. Cupos disponibles: {datos.cupo.disponibles}.
          </p>
          <div
            role="progressbar"
            aria-label="Cupo de participantes utilizado"
            aria-valuemin={0}
            aria-valuemax={datos.cupo.aprobado}
            aria-valuenow={datos.cupo.ocupados}
            className="h-2.5 w-full overflow-hidden rounded-full bg-interaccion-fuerte"
          >
            <div
              className={
                datos.cupo.completo
                  ? "h-full rounded-full bg-advertencia transition-all"
                  : "h-full rounded-full bg-primario transition-all"
              }
              style={{
                width: `${Math.min(
                  100,
                  (datos.cupo.ocupados / Math.max(1, datos.cupo.aprobado)) * 100,
                )}%`,
              }}
            />
          </div>
          {datos.cupo.completo && gestionable ? (
            <Alerta tono="advertencia">
              <p className="font-semibold">
                Se alcanzó el cupo aprobado de {datos.cupo.aprobado}{" "}
                participantes.
              </p>
              <p className="mt-1">
                Retira un participante para poder agregar otro.
              </p>
            </Alerta>
          ) : null}
        </TarjetaCuerpo>
      </Tarjeta>

      {puedeAgregar ? (
        <Tarjeta>
          <TarjetaCuerpo>
            <FormularioParticipante
              valores={valores}
              errores={errores}
              catalogo={datos.productosCatalogo}
              productosPermitidos={productosPermitidos}
              deshabilitado={!gestionable}
              enviando={creando}
              titulo="Agregar participante"
              textoBoton="Agregar participante"
              onCambiar={cambiar}
              onAlternarProducto={alternarProducto}
              onSubmit={crear}
            />
          </TarjetaCuerpo>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <TarjetaEncabezado>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-titulo">
              Lista de participantes
            </h2>
            <span className="text-sm text-tenue">
              {datos.participantes.length} registrado(s)
            </span>
          </div>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          {datos.participantes.length === 0 ? (
            <EstadoVacio
              titulo="Aún no hay participantes"
              descripcion="Agrega el primer vendedor con sus datos y los productos que ofrecerá en la feria."
            />
          ) : (
            <ListaParticipantes
              participantes={datos.participantes}
              bloqueado={bloqueado}
              onEditar={abrirEdicion}
              onRetirar={setRetirando}
            />
          )}
        </TarjetaCuerpo>
      </Tarjeta>

      {gestionable ? (
        <div className="flex flex-col gap-2 rounded-xl border border-borde bg-superficie p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-titulo">
              Enviar el listado final
            </p>
            <p className="text-sm text-texto">
              Al enviarlo, el gestor podrá consultarlo y ya no se podrán
              agregar, editar ni retirar participantes.
            </p>
            {!puedeEnviar && datos.participantes.length === 0 ? (
              <p className="mt-1 text-sm text-tenue">
                Agrega al menos un participante para habilitar el envío.
              </p>
            ) : null}
          </div>
          <Boton
            onClick={() => {
              setErrorEnvio(null);
              setConfirmarEnvio(true);
            }}
            disabled={!puedeEnviar}
          >
            Enviar listado final
          </Boton>
        </div>
      ) : null}

      <Modal
        abierto={editando !== null}
        titulo="Editar participante"
        descripcion={editando?.nombre}
        onCerrar={() => setEditando(null)}
      >
        <FormularioParticipante
          valores={valoresEdicion}
          errores={erroresEdicion}
          catalogo={datos.productosCatalogo}
          productosPermitidos={productosPermitidos}
          deshabilitado={!gestionable}
          enviando={guardando}
          titulo="Datos del vendedor"
          textoBoton="Guardar cambios"
          onCambiar={cambiarEdicion}
          onAlternarProducto={alternarProductoEdicion}
          onSubmit={guardarEdicion}
          onCancelar={() => setEditando(null)}
        />
      </Modal>

      <Modal
        abierto={retirando !== null}
        titulo="Retirar participante"
        descripcion={retirando?.nombre}
        onCerrar={() => setRetirando(null)}
      >
        <p className="text-sm text-texto">
          El vendedor dejará de aparecer en la lista y liberará su cupo. La
          información se conserva para trazabilidad.
        </p>
        <div className="mt-5">
          <AccionesModal
            textoConfirmar="Retirar participante"
            variante="peligro"
            cargando={retirandoCargando}
            onCancelar={() => setRetirando(null)}
            onConfirmar={confirmarRetiro}
          />
        </div>
      </Modal>

      <Modal
        abierto={confirmarEnvio}
        titulo="Enviar listado final"
        descripcion={`${datos.participantes.length} participante(s)`}
        onCerrar={() => setConfirmarEnvio(false)}
      >
        <p className="text-sm text-texto">
          El gestor verá esta lista y sus productos. Después del envío no se
          podrán hacer cambios en los participantes.
        </p>
        {errorEnvio ? (
          <div className="mt-3">
            <Alerta tono="error">{errorEnvio}</Alerta>
          </div>
        ) : null}
        <div className="mt-5">
          <AccionesModal
            textoConfirmar="Enviar listado final"
            cargando={enviandoListado}
            onCancelar={() => setConfirmarEnvio(false)}
            onConfirmar={enviarListado}
          />
        </div>
      </Modal>
    </section>
  );
}
