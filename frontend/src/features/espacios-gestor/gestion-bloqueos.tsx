"use client";

import { useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import {
  actualizarBloqueoEspacio,
  ApiError,
  comoApiError,
  crearBloqueoEspacio,
  eliminarBloqueoEspacio,
} from "@/lib/api-client";
import type { BloqueoEspacioGestor } from "@/types/api";
import { CalendarioBloqueos } from "./calendario-bloqueos";
import { validarRangoBloqueo } from "./validaciones-espacio";

interface GestionBloqueosProps {
  espacioId: string;
  bloqueos: BloqueoEspacioGestor[];
  asignacionManual: boolean;
  onRecargar: () => void;
}

interface ValoresBloqueo {
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
}

function valoresVacios(): ValoresBloqueo {
  return { fechaInicio: "", fechaFin: "", motivo: "" };
}

function valoresDesdeBloqueo(bloqueo: BloqueoEspacioGestor): ValoresBloqueo {
  return {
    fechaInicio: bloqueo.fechaInicio,
    fechaFin: bloqueo.fechaFin,
    motivo: bloqueo.motivo ?? "",
  };
}

/** Gestión de bloqueos por rango de fechas con calendario mensual. */
export function GestionBloqueos({
  espacioId,
  bloqueos,
  asignacionManual,
  onRecargar,
}: GestionBloqueosProps) {
  const [valores, setValores] = useState<ValoresBloqueo>(valoresVacios);
  const [editando, setEditando] = useState<BloqueoEspacioGestor | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [bloqueoEliminar, setBloqueoEliminar] =
    useState<BloqueoEspacioGestor | null>(null);
  const [eliminando, setEliminando] = useState(false);

  function abrirNuevo(): void {
    setEditando(null);
    setValores(valoresVacios());
    setFormularioAbierto(true);
    setError(null);
    setExito(null);
  }

  function abrirEdicion(bloqueo: BloqueoEspacioGestor): void {
    setEditando(bloqueo);
    setValores(valoresDesdeBloqueo(bloqueo));
    setFormularioAbierto(true);
    setError(null);
    setExito(null);
  }

  function seleccionarDia(fecha: string): void {
    setFormularioAbierto(true);
    setEditando(null);
    setError(null);
    setExito(null);
    setValores((actuales) => {
      if (!actuales.fechaInicio || (actuales.fechaInicio && actuales.fechaFin)) {
        return { ...actuales, fechaInicio: fecha, fechaFin: fecha };
      }
      if (fecha < actuales.fechaInicio) {
        return { ...actuales, fechaInicio: fecha };
      }
      return { ...actuales, fechaFin: fecha };
    });
  }

  async function guardar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (guardando) return;
    const problema = validarRangoBloqueo(
      valores.fechaInicio,
      valores.fechaFin,
    );
    if (problema) {
      setError(new ApiError(400, problema));
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const datos = {
        fechaInicio: valores.fechaInicio,
        fechaFin: valores.fechaFin,
        motivo: valores.motivo.trim() || null,
      };
      if (editando) {
        await actualizarBloqueoEspacio(espacioId, editando.id, datos);
        setExito("El bloqueo se actualizó correctamente.");
      } else {
        await crearBloqueoEspacio(espacioId, datos);
        setExito("El bloqueo se creó correctamente.");
      }
      setFormularioAbierto(false);
      setEditando(null);
      setValores(valoresVacios());
      onRecargar();
    } catch (capturado) {
      setError(comoApiError(capturado));
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar(): Promise<void> {
    if (!bloqueoEliminar || eliminando) return;
    setEliminando(true);
    setError(null);
    try {
      await eliminarBloqueoEspacio(espacioId, bloqueoEliminar.id);
      setExito("El bloqueo se eliminó correctamente.");
      setBloqueoEliminar(null);
      onRecargar();
    } catch (capturado) {
      setError(comoApiError(capturado));
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-titulo">
            Bloqueos por fechas
          </h2>
          <p className="mt-1 text-sm text-texto">
            Bloquea el espacio por mantenimiento o evento. No se permiten fechas
            que se crucen con permisos, solicitudes aprobadas u otros bloqueos.
          </p>
        </div>
        <Boton
          variante="contorno"
          onClick={abrirNuevo}
          disabled={asignacionManual}
        >
          Nuevo bloqueo
        </Boton>
      </div>

      {asignacionManual ? (
        <Alerta tono="advertencia">
          El espacio tiene una asignación manual. Libera la asignación antes de
          crear o editar bloqueos.
        </Alerta>
      ) : null}
      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}
      {error && !formularioAbierto && !bloqueoEliminar ? (
        <Alerta tono="error">{error.mensaje}</Alerta>
      ) : null}

      <Tarjeta>
        <TarjetaCuerpo>
          <CalendarioBloqueos
            bloqueos={bloqueos}
            onSeleccionarDia={
              asignacionManual ? undefined : seleccionarDia
            }
            onEditarBloqueo={
              asignacionManual ? undefined : abrirEdicion
            }
          />
        </TarjetaCuerpo>
      </Tarjeta>

      {bloqueos.length > 0 ? (
        <Tarjeta>
          <TarjetaCuerpo>
            <h3 className="text-base font-bold text-titulo">
              Bloqueos registrados
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {bloqueos.map((bloqueo) => (
                <li
                  key={bloqueo.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borde p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-titulo">
                      {bloqueo.fechaInicio} a {bloqueo.fechaFin}
                    </p>
                    <p className="text-xs text-tenue">
                      {bloqueo.motivo ?? "Sin motivo registrado"} ·{" "}
                      {bloqueo.creadoPorNombre}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {bloqueo.activo ? (
                      <Etiqueta tono="info">Vigente hoy</Etiqueta>
                    ) : null}
                    <Boton
                      variante="contorno"
                      tamano="sm"
                      disabled={asignacionManual}
                      onClick={() => abrirEdicion(bloqueo)}
                    >
                      Editar
                    </Boton>
                    <Boton
                      variante="peligro"
                      tamano="sm"
                      disabled={asignacionManual}
                      onClick={() => {
                        setError(null);
                        setExito(null);
                        setBloqueoEliminar(bloqueo);
                      }}
                    >
                      Eliminar
                    </Boton>
                  </div>
                </li>
              ))}
            </ul>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : null}

      {formularioAbierto ? (
        <Tarjeta>
          <TarjetaCuerpo>
            <form onSubmit={(evento) => void guardar(evento)} className="flex flex-col gap-4">
              <h3 className="text-base font-bold text-titulo">
                {editando ? "Editar bloqueo" : "Nuevo bloqueo"}
              </h3>
              {error ? <Alerta tono="error">{error.mensaje}</Alerta> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  etiqueta="Fecha de inicio"
                  type="date"
                  requerido
                  value={valores.fechaInicio}
                  onChange={(evento) =>
                    setValores({ ...valores, fechaInicio: evento.target.value })
                  }
                />
                <Campo
                  etiqueta="Fecha de fin"
                  type="date"
                  requerido
                  value={valores.fechaFin}
                  onChange={(evento) =>
                    setValores({ ...valores, fechaFin: evento.target.value })
                  }
                />
              </div>
              <Campo
                etiqueta="Motivo"
                value={valores.motivo}
                maxLength={300}
                placeholder="Ej. Mantenimiento del andén"
                onChange={(evento) =>
                  setValores({ ...valores, motivo: evento.target.value })
                }
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Boton
                  variante="fantasma"
                  onClick={() => {
                    setFormularioAbierto(false);
                    setEditando(null);
                    setError(null);
                  }}
                >
                  Cancelar
                </Boton>
                <Boton type="submit" cargando={guardando}>
                  {editando ? "Guardar bloqueo" : "Crear bloqueo"}
                </Boton>
              </div>
            </form>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : null}

      <Modal
        abierto={bloqueoEliminar !== null}
        titulo="Eliminar bloqueo"
        descripcion="El espacio volverá a calcular su estado sin este bloqueo."
        onCerrar={() => setBloqueoEliminar(null)}
      >
        <div className="flex flex-col gap-4">
          {error ? <Alerta tono="error">{error.mensaje}</Alerta> : null}
          <p className="text-sm text-texto">
            Bloqueo:{" "}
            <span className="font-semibold text-titulo">
              {bloqueoEliminar?.fechaInicio} a {bloqueoEliminar?.fechaFin}
            </span>
          </p>
          <AccionesModal
            onCancelar={() => setBloqueoEliminar(null)}
            onConfirmar={() => void confirmarEliminar()}
            textoConfirmar="Eliminar bloqueo"
            variante="peligro"
            cargando={eliminando}
          />
        </div>
      </Modal>
    </div>
  );
}
