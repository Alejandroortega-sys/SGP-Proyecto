"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { useSesion } from "@/hooks/use-sesion";
import {
  ApiError,
  comoApiError,
  crearGestor,
} from "@/lib/api-client";
import { validarCorreo, validarNombre } from "@/lib/validaciones";
import type { GestorCreado, PerfilGestor } from "@/types/api";

export function CrearGestor() {
  const { usuario } = useSesion();
  const esAdministrador = usuario?.perfil === "administrador";

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [correo, setCorreo] = useState("");
  const [perfil, setPerfil] = useState<PerfilGestor>("revisor");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [creado, setCreado] = useState<GestorCreado | null>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const errorNombre = validarNombre(nombre);
    const errorCorreo = validarCorreo(correo);
    if (errorNombre || errorCorreo) {
      setError(
        new ApiError(400, errorNombre ?? errorCorreo ?? "Revisa los datos."),
      );
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const respuesta = await crearGestor({
        nombre: nombre.trim(),
        ...(apellido.trim() === "" ? {} : { apellido: apellido.trim() }),
        correo: correo.trim().toLowerCase(),
        perfil,
      });
      setCreado(respuesta);
      setNombre("");
      setApellido("");
      setCorreo("");
      setPerfil("revisor");
    } catch (capturado) {
      setError(comoApiError(capturado));
    } finally {
      setEnviando(false);
    }
  }

  if (!esAdministrador) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold text-titulo">Crear gestor</h1>
        <Alerta tono="error">
          Solo un gestor con perfil administrador puede crear nuevas cuentas de
          gestor.
        </Alerta>
        <Link
          href="/gestor/panel"
          className="text-sm font-semibold text-primario hover:underline"
        >
          ← Volver al panel
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/gestor/usuarios"
          className="text-sm font-semibold text-primario hover:underline"
        >
          ← Volver al listado de cuentas
        </Link>
        <h1 className="mt-3 text-2xl font-extrabold text-titulo sm:text-3xl">
          Crear gestor municipal
        </h1>
        <p className="mt-2 max-w-2xl text-base text-texto">
          La cuenta nace en estado «pendiente de activación». El gestor recibirá
          una contraseña temporal por correo y deberá cambiarla en su primer
          acceso.
        </p>
      </div>

      {creado ? (
        <Alerta tono="exito">
          <p className="font-semibold">{creado.mensaje}</p>
          <p className="mt-1">
            {creado.nombre} {creado.apellido ?? ""} · {creado.correo} ·{" "}
            {creado.perfil === "administrador" ? "Administrador" : "Revisor"}
          </p>
          <p className="mt-2 text-sm">
            Si el correo no llegó, puedes reenviar la invitación desde el detalle
            de la cuenta o desde el listado de usuarios.
          </p>
          <Link
            href={`/gestor/usuarios/${creado.id}`}
            className="mt-2 inline-block font-semibold underline"
          >
            Ver la cuenta creada
          </Link>
        </Alerta>
      ) : null}

      <Tarjeta>
        <TarjetaEncabezado>
          <h2 className="text-base font-bold text-titulo">Datos del nuevo gestor</h2>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Nombres"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                requerido
              />
              <Campo
                etiqueta="Apellidos"
                value={apellido}
                onChange={(evento) => setApellido(evento.target.value)}
              />
              <Campo
                etiqueta="Correo institucional"
                type="email"
                value={correo}
                onChange={(evento) => setCorreo(evento.target.value)}
                placeholder="nombre@tulua.gov.co"
                requerido
              />
              <Selector
                etiqueta="Perfil"
                value={perfil}
                onChange={(evento) => setPerfil(evento.target.value as PerfilGestor)}
              >
                <option value="revisor">Revisor (solo consulta)</option>
                <option value="administrador">Administrador</option>
              </Selector>
            </div>

            {error ? <Alerta tono="error">{error.mensaje}</Alerta> : null}
            {error?.status === 503 ? (
              <Alerta tono="advertencia">
                La cuenta pudo haberse creado aunque el correo falló. Revisa el
                listado de usuarios y reenvía la invitación.
              </Alerta>
            ) : null}

            <div className="flex justify-end">
              <Boton type="submit" cargando={enviando}>
                Crear gestor
              </Boton>
            </div>
          </form>
        </TarjetaCuerpo>
      </Tarjeta>
    </div>
  );
}
