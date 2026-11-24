"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { IconoLuna, IconoSol } from "@/components/ui/iconos";
import { Modal, AccionesModal } from "@/components/ui/modal";
import { Paginacion } from "@/components/ui/paginacion";
import {
  Pestanas,
  PestanaPanel,
  type Pestana,
} from "@/components/ui/pestanas";

/** Conmutador claro/oscuro: añade o quita `.dark` en <html>. */
export function ConmutadorTema() {
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", oscuro);
  }, [oscuro]);

  return (
    <button
      type="button"
      onClick={() => setOscuro((valor) => !valor)}
      aria-pressed={oscuro}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-borde-fuerte bg-superficie px-3.5 text-sm font-medium text-titulo transition-colors duration-150 hover:bg-interaccion focus-visible:outline-2 focus-visible:outline-accent"
    >
      {oscuro ? <IconoLuna className="size-4" /> : <IconoSol className="size-4" />}
      {oscuro ? "Cambiar a claro" : "Cambiar a oscuro"}
    </button>
  );
}

const PESTANAS: Pestana[] = [
  { id: "general", texto: "General" },
  { id: "documentos", texto: "Documentos" },
  { id: "historial", texto: "Historial" },
];

export function DemoPestanas() {
  const [activa, setActiva] = useState("general");

  return (
    <div>
      <Pestanas
        idBase="diseno-pestanas"
        pestanas={PESTANAS}
        activa={activa}
        onCambiar={setActiva}
      />
      <PestanaPanel idBase="diseno-pestanas" idPestana="general" activa={activa === "general"}>
        <p className="text-sm text-texto">
          Panel «General»: usa las flechas ← → del teclado para moverte entre
          pestañas.
        </p>
      </PestanaPanel>
      <PestanaPanel idBase="diseno-pestanas" idPestana="documentos" activa={activa === "documentos"}>
        <p className="text-sm text-texto">
          Panel «Documentos»: cada panel está enlazado a su pestaña con
          <span className="font-mono"> aria-controls</span>.
        </p>
      </PestanaPanel>
      <PestanaPanel idBase="diseno-pestanas" idPestana="historial" activa={activa === "historial"}>
        <p className="text-sm text-texto">
          Panel «Historial»: los paneles inactivos se ocultan sin desmontarse.
        </p>
      </PestanaPanel>
    </div>
  );
}

export function DemoModal() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Boton variante="solido" onClick={() => setAbierto(true)}>
        Abrir modal
      </Boton>
      <Modal
        abierto={abierto}
        titulo="Publicar zona"
        descripcion="La zona quedará visible en el mapa público y en el geo-portal."
        onCerrar={() => setAbierto(false)}
      >
        <p className="text-sm text-texto">
          Contenido de ejemplo. El modal se cierra con la tecla Escape, con el
          botón «Cancelar» o haciendo clic fuera del panel.
        </p>
        <div className="mt-6">
          <AccionesModal
            onCancelar={() => setAbierto(false)}
            onConfirmar={() => setAbierto(false)}
            textoConfirmar="Publicar zona"
          />
        </div>
      </Modal>
    </>
  );
}

export function DemoPaginacion() {
  const [pagina, setPagina] = useState(2);
  return <Paginacion pagina={pagina} totalPaginas={7} onCambiar={setPagina} />;
}

export function DemoBloqueError() {
  const [intentos, setIntentos] = useState(0);

  return (
    <div className="space-y-3">
      <BloqueError
        error={new ApiError(503, "El servicio de zonas no responde.")}
        onReintentar={() => setIntentos((valor) => valor + 1)}
      />
      <p className="text-xs text-tenue">Reintentos: {intentos}</p>
    </div>
  );
}
