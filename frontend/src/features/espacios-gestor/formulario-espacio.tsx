"use client";

import { Alerta } from "@/components/ui/alerta";
import { Campo, Selector } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { formatearTipoEspacio } from "@/features/espacios/estilos-espacio";
import type { ZonaOpcionEspacio } from "@/types/api";
import type { ErroresEspacio, ValoresEspacio } from "./validaciones-espacio";

interface FormularioEspacioProps {
  valores: ValoresEspacio;
  errores: ErroresEspacio;
  zona: ZonaOpcionEspacio | null;
  cargandoZona: boolean;
  onCambiar: (valores: ValoresEspacio) => void;
}

function textoZona(zona: ZonaOpcionEspacio | null): string {
  if (!zona) return "Fuera de toda zona activa";
  return `${zona.nombre} (${zona.tipo.replace("_", " ")})`;
}

/** Formulario de datos del espacio temporal. */
export function FormularioEspacio({
  valores,
  errores,
  zona,
  cargandoZona,
  onCambiar,
}: FormularioEspacioProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-titulo">Datos del espacio</h2>
        <p className="mt-1 text-sm text-texto">
          La ubicación se selecciona en el mapa. La zona activa se detecta
          automáticamente y el sector se propone a partir de ella.
        </p>
      </div>

      <Campo
        etiqueta="Nombre"
        requerido
        value={valores.nombre}
        error={errores.nombre}
        maxLength={150}
        placeholder="Ej. Puesto Plaza Boyacá - Occidente"
        onChange={(evento) =>
          onCambiar({ ...valores, nombre: evento.target.value })
        }
      />

      <Selector
        etiqueta="Tipo de espacio"
        requerido
        value={valores.tipo}
        error={errores.tipo}
        onChange={(evento) =>
          onCambiar({
            ...valores,
            tipo: evento.target.value as ValoresEspacio["tipo"],
          })
        }
      >
        <option value="">Selecciona un tipo</option>
        <option value="puesto">Puesto</option>
        <option value="modulo">Módulo</option>
        <option value="kiosco">Kiosco</option>
        <option value="espacio_movil">Espacio móvil</option>
      </Selector>

      <div className="rounded-lg border border-borde bg-fondo p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-tenue">
          Zona detectada
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-titulo">{textoZona(zona)}</p>
          {valores.tipo ? (
            <Etiqueta tono="neutro">
              {formatearTipoEspacio(valores.tipo)}
            </Etiqueta>
          ) : null}
        </div>
        {cargandoZona ? (
          <p className="mt-1 text-xs text-tenue">Consultando la zona…</p>
        ) : null}
        {!cargandoZona && !zona && valores.punto ? (
          <p className="mt-1 text-xs text-tenue">
            El punto está fuera de las zonas activas. Puedes guardarlo igualmente
            indicando el sector manualmente.
          </p>
        ) : null}
      </div>

      <Campo
        etiqueta="Sector"
        value={valores.sector}
        error={errores.sector}
        maxLength={100}
        ayuda="Se completa con el nombre de la zona, pero puedes ajustarlo."
        onChange={(evento) =>
          onCambiar({ ...valores, sector: evento.target.value })
        }
      />

      <Campo
        etiqueta="Dimensiones"
        value={valores.dimensiones}
        error={errores.dimensiones}
        maxLength={60}
        placeholder="Ej. 4 × 3 m"
        onChange={(evento) =>
          onCambiar({ ...valores, dimensiones: evento.target.value })
        }
      />

      <Campo
        etiqueta="Actividad permitida"
        value={valores.actividadPermitida}
        error={errores.actividad}
        maxLength={100}
        placeholder="Ej. Comidas rápidas"
        onChange={(evento) =>
          onCambiar({ ...valores, actividadPermitida: evento.target.value })
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Horario desde"
          type="time"
          value={valores.horarioInicio}
          error={errores.horario}
          onChange={(evento) =>
            onCambiar({ ...valores, horarioInicio: evento.target.value })
          }
        />
        <Campo
          etiqueta="Horario hasta"
          type="time"
          value={valores.horarioFin}
          onChange={(evento) =>
            onCambiar({ ...valores, horarioFin: evento.target.value })
          }
        />
      </div>

      <Selector
        etiqueta="Estado manual"
        value={valores.estado}
        ayuda="Bloqueado y asignado se calculan automáticamente con las fechas."
        onChange={(evento) =>
          onCambiar({
            ...valores,
            estado: evento.target.value as ValoresEspacio["estado"],
          })
        }
      >
        <option value="disponible">Disponible</option>
        <option value="mantenimiento">En mantenimiento</option>
      </Selector>

      {errores.horario ? (
        <Alerta tono="advertencia">{errores.horario}</Alerta>
      ) : null}

      <p className="text-xs text-tenue">
        Los campos marcados con <span className="text-rose-600">*</span> son
        obligatorios. El estado bloqueado o asignado no se elige aquí.
      </p>
    </div>
  );
}
