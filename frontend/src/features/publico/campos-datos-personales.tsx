"use client";

import { Campo, Selector } from "@/components/ui/campo";
import type { TipoDocumento } from "@/types/api";
import { validarApellido, validarCorreo, validarDocumento, validarNombre, validarTelefono } from "@/lib/validaciones";

export interface DatosPersonales {
  nombre: string;
  apellido: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  telefono: string;
  correo: string;
}

export type ErroresPersonales = Partial<
  Record<keyof DatosPersonales, string | null>
>;

export const DATOS_PERSONALES_VACIOS: DatosPersonales = {
  nombre: "",
  apellido: "",
  tipoDocumento: "CC",
  documento: "",
  telefono: "",
  correo: "",
};

const OPCIONES_DOCUMENTO: Array<{ valor: TipoDocumento; texto: string }> = [
  { valor: "CC", texto: "CC — Cédula de Ciudadanía" },
  { valor: "CE", texto: "CE — Cédula de Extranjería" },
  { valor: "TI", texto: "TI — Tarjeta de Identidad" },
  { valor: "PP", texto: "PP — Pasaporte" },
  { valor: "NIT", texto: "NIT" },
];

export function validarDatosPersonales(
  datos: DatosPersonales,
): ErroresPersonales {
  return {
    nombre: validarNombre(datos.nombre),
    apellido: validarApellido(datos.apellido),
    documento: validarDocumento(datos.documento),
    telefono: validarTelefono(datos.telefono),
    correo: validarCorreo(datos.correo),
  };
}

export function hayErroresPersonales(errores: ErroresPersonales): boolean {
  return Object.values(errores).some((error) => Boolean(error));
}

interface PropiedadesCamposPersonales {
  datos: DatosPersonales;
  errores: ErroresPersonales;
  onCambio: (actualizacion: Partial<DatosPersonales>) => void;
}

export function CamposDatosPersonales({
  datos,
  errores,
  onCambio,
}: PropiedadesCamposPersonales) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo
        etiqueta="Nombres"
        name="nombre"
        autoComplete="given-name"
        placeholder="Ej. Juan Carlos"
        requerido
        value={datos.nombre}
        onChange={(evento) => onCambio({ nombre: evento.target.value })}
        error={errores.nombre ?? null}
      />
      <Campo
        etiqueta="Apellidos"
        name="apellido"
        autoComplete="family-name"
        placeholder="Ej. Pérez Gómez"
        value={datos.apellido}
        onChange={(evento) => onCambio({ apellido: evento.target.value })}
        error={errores.apellido ?? null}
      />
      <Selector
        etiqueta="Tipo de Documento"
        name="tipoDocumento"
        requerido
        value={datos.tipoDocumento}
        onChange={(evento) =>
          onCambio({ tipoDocumento: evento.target.value as TipoDocumento })
        }
        error={errores.tipoDocumento ?? null}
      >
        {OPCIONES_DOCUMENTO.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </Selector>
      <Campo
        etiqueta="Número de Documento"
        name="documento"
        autoComplete="off"
        inputMode="text"
        placeholder="Ej. 1032456789"
        requerido
        value={datos.documento}
        onChange={(evento) => onCambio({ documento: evento.target.value })}
        error={errores.documento ?? null}
        ayuda="Este dato no podrá ser modificado posteriormente sin autorización del gestor municipal."
      />
      <Campo
        etiqueta="Teléfono / Celular"
        type="tel"
        name="telefono"
        autoComplete="tel-national"
        inputMode="tel"
        placeholder="Ej. 3214567890"
        requerido
        value={datos.telefono}
        onChange={(evento) => onCambio({ telefono: evento.target.value })}
        error={errores.telefono ?? null}
        ayuda="Formato colombiano: 10 dígitos."
      />
      <Campo
        etiqueta="Correo electrónico"
        type="email"
        name="correo"
        autoComplete="email"
        inputMode="email"
        placeholder="usuario@correo.com"
        requerido
        className="sm:col-span-2"
        value={datos.correo}
        onChange={(evento) => onCambio({ correo: evento.target.value })}
        error={errores.correo ?? null}
        ayuda="A este correo enviaremos tu código de activación."
      />
    </div>
  );
}
