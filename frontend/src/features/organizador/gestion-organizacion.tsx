"use client";

/* eslint-disable react-hooks/set-state-in-effect -- el formulario se hidrata con la organización consultada */
import { useEffect, useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estado-vacio";
import { EtiquetaEstado } from "@/components/ui/etiqueta";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  actualizarMiOrganizacion,
  ApiError,
  comoApiError,
  crearMiOrganizacion,
  obtenerMiOrganizacion,
} from "@/lib/api-client";
import { formatearFecha } from "@/lib/formato";
import { NIT_RE } from "@/lib/validaciones";

interface FormularioOrganizacion {
  nombreOrganizacion: string;
  nit: string;
  representante: string;
  tipoFeria: string;
  contacto: string;
}

const FORMULARIO_VACIO: FormularioOrganizacion = {
  nombreOrganizacion: "",
  nit: "",
  representante: "",
  tipoFeria: "",
  contacto: "",
};

export function GestionOrganizacion() {
  const { datos, cargando, error, recargar } = useConsultaApi(
    obtenerMiOrganizacion,
    [],
  );

  const [formulario, setFormulario] =
    useState<FormularioOrganizacion>(FORMULARIO_VACIO);
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    if (!datos) return;
    setFormulario({
      nombreOrganizacion: datos.nombreOrganizacion,
      nit: datos.nit,
      representante: datos.representante,
      tipoFeria: datos.tipoFeria,
      contacto: datos.contacto ?? "",
    });
  }, [datos]);

  function cambiar(campo: keyof FormularioOrganizacion, valor: string) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const errores: string[] = [];
    if (formulario.nombreOrganizacion.trim().length < 3) {
      errores.push("El nombre de la organización debe tener al menos 3 caracteres.");
    }
    if (!NIT_RE.test(formulario.nit.trim())) {
      errores.push("El NIT debe tener entre 8 y 10 dígitos y, opcionalmente, guion y dígito de verificación.");
    }
    if (formulario.representante.trim().length < 3) {
      errores.push("El representante debe tener al menos 3 caracteres.");
    }
    if (formulario.tipoFeria.trim().length < 3) {
      errores.push("El tipo de feria debe tener al menos 3 caracteres.");
    }
    if (errores.length > 0) {
      setErrorFormulario(new ApiError(400, errores.join("\n")));
      return;
    }

    setEnviando(true);
    setErrorFormulario(null);
    setExito(null);
    try {
      const cuerpo = {
        nombreOrganizacion: formulario.nombreOrganizacion.trim(),
        nit: formulario.nit.trim(),
        representante: formulario.representante.trim(),
        tipoFeria: formulario.tipoFeria.trim(),
        ...(formulario.contacto.trim() === ""
          ? {}
          : { contacto: formulario.contacto.trim() }),
      };
      const respuesta = datos
        ? await actualizarMiOrganizacion(cuerpo)
        : await crearMiOrganizacion(cuerpo);
      setExito(respuesta.mensaje ?? "Organización guardada correctamente.");
      setEditando(false);
      recargar();
    } catch (capturado) {
      setErrorFormulario(comoApiError(capturado));
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <Cargando texto="Consultando tu organización…" />;

  const noExiste = error?.status === 404;
  if (error && !noExiste) {
    return <BloqueError error={error} onReintentar={recargar} />;
  }

  const mostrarFormulario = !datos || editando;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
          Mi organización
        </h1>
        <p className="mt-2 max-w-2xl text-base text-texto">
          Registra los datos de la organización que representa. La Alcaldía
          validará la información antes de habilitar las ferias.
        </p>
      </div>

      {datos ? (
        <Tarjeta>
          <TarjetaEncabezado className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-titulo">
                {datos.nombreOrganizacion}
              </h2>
              <p className="mt-1 text-sm text-texto">NIT {datos.nit}</p>
            </div>
            <EtiquetaEstado estado={datos.estado} />
          </TarjetaEncabezado>
          <TarjetaCuerpo className="grid gap-4 text-sm sm:grid-cols-2">
            <p>
              <span className="block text-xs uppercase text-tenue">Representante</span>
              <span className="font-medium text-titulo">{datos.representante}</span>
            </p>
            <p>
              <span className="block text-xs uppercase text-tenue">Tipo de feria</span>
              <span className="font-medium text-titulo">{datos.tipoFeria}</span>
            </p>
            <p>
              <span className="block text-xs uppercase text-tenue">Contacto</span>
              <span className="font-medium text-titulo">
                {datos.contacto ?? "—"}
              </span>
            </p>
            <p>
              <span className="block text-xs uppercase text-tenue">
                Fecha de validación
              </span>
              <span className="font-medium text-titulo">
                {datos.validadoEn ? formatearFecha(datos.validadoEn) : "Pendiente"}
              </span>
            </p>
          </TarjetaCuerpo>
          {datos.estado === "pendiente_validacion" ? (
            <div className="border-t border-borde px-5 py-4 sm:px-6">
              <Alerta tono="advertencia" conIcono={false}>
                Tu organización está pendiente de validación por la Alcaldía. Te
                avisaremos cuando el gestor revise la información.
              </Alerta>
            </div>
          ) : null}
          {datos.estado === "suspendida" ? (
            <div className="border-t border-borde px-5 py-4 sm:px-6">
              <Alerta tono="error" conIcono={false}>
                Tu organización está suspendida. Contacta a la Secretaría de
                Gobierno para conocer el motivo y reactivarla.
              </Alerta>
            </div>
          ) : null}
          {!editando ? (
            <div className="flex justify-end border-t border-borde px-5 py-4 sm:px-6">
              <Boton variante="contorno" onClick={() => setEditando(true)}>
                Editar organización
              </Boton>
            </div>
          ) : null}
        </Tarjeta>
      ) : null}

      {mostrarFormulario ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">
              {datos ? "Editar organización" : "Registrar organización"}
            </h2>
            <p className="mt-1 text-sm text-texto">
              El estado de validación lo asigna únicamente la Alcaldía.
            </p>
          </TarjetaEncabezado>
          <TarjetaCuerpo>
            <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  etiqueta="Nombre de la organización"
                  value={formulario.nombreOrganizacion}
                  onChange={(evento) => cambiar("nombreOrganizacion", evento.target.value)}
                  requerido
                />
                <Campo
                  etiqueta="NIT"
                  value={formulario.nit}
                  onChange={(evento) => cambiar("nit", evento.target.value)}
                  placeholder="900123456-1"
                  requerido
                />
                <Campo
                  etiqueta="Representante legal"
                  value={formulario.representante}
                  onChange={(evento) => cambiar("representante", evento.target.value)}
                  requerido
                />
                <Campo
                  etiqueta="Tipo de feria"
                  value={formulario.tipoFeria}
                  onChange={(evento) => cambiar("tipoFeria", evento.target.value)}
                  placeholder="Feria agroecológica"
                  requerido
                />
                <Campo
                  etiqueta="Contacto"
                  value={formulario.contacto}
                  onChange={(evento) => cambiar("contacto", evento.target.value)}
                  ayuda="Teléfono o correo de contacto de la organización."
                />
              </div>

              {errorFormulario ? (
                <Alerta tono="error">{errorFormulario.mensaje}</Alerta>
              ) : null}
              {exito ? <Alerta tono="exito">{exito}</Alerta> : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {datos ? (
                  <Boton
                    variante="fantasma"
                    onClick={() => {
                      setEditando(false);
                      setErrorFormulario(null);
                    }}
                  >
                    Cancelar
                  </Boton>
                ) : null}
                <Boton type="submit" cargando={enviando}>
                  {datos ? "Guardar cambios" : "Registrar organización"}
                </Boton>
              </div>
            </form>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : null}

      {exito && !mostrarFormulario ? <Alerta tono="exito">{exito}</Alerta> : null}
    </div>
  );
}
