import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueCodigo } from "@/components/ui/bloque-codigo";
import { Boton } from "@/components/ui/boton";
import { Campo, CampoPassword, Selector } from "@/components/ui/campo";
import {
  Esqueleto,
  EsqueletoCircular,
  EsqueletoTexto,
} from "@/components/ui/esqueleto";
import { Etiqueta, EtiquetaEstado } from "@/components/ui/etiqueta";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoCheck,
  IconoEscudo,
  IconoPersona,
} from "@/components/ui/iconos";
import { Tabla, Td, Th } from "@/components/ui/tabla";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
  TarjetaPie,
} from "@/components/ui/tarjeta";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ConmutadorTema,
  DemoBloqueError,
  DemoModal,
  DemoPaginacion,
  DemoPestanas,
} from "./interactivo-diseno";

export const metadata: Metadata = {
  title: "Sistema de diseño",
};

/* ------------------------------------------------------------------ */
/* Helpers de la página                                                */
/* ------------------------------------------------------------------ */

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="text-xl font-semibold text-titulo">{titulo}</h2>
      {descripcion ? (
        <p className="mt-1 max-w-2xl text-sm text-texto">{descripcion}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MuestraColor({
  nombre,
  token,
  color,
}: {
  nombre: string;
  token: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-borde bg-superficie p-3">
      <span
        aria-hidden="true"
        className="size-10 shrink-0 rounded-md border border-borde-fuerte"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-titulo">{nombre}</span>
        <span className="block truncate font-mono text-xs text-tenue">
          {token}
        </span>
      </span>
    </div>
  );
}

const ESCALA_TIPOGRAFIA = [
  { clase: "text-4xl", px: 48, uso: "Titular de portada" },
  { clase: "text-3xl", px: 32, uso: "Título de página (h1)" },
  { clase: "text-2xl", px: 24, uso: "Sección (h2)" },
  { clase: "text-xl", px: 20, uso: "Subsección (h3)" },
  { clase: "text-lg", px: 16, uso: "Énfasis" },
  { clase: "text-base", px: 14, uso: "Cuerpo" },
  { clase: "text-sm", px: 13, uso: "UI densa" },
  { clase: "text-xs", px: 12, uso: "Etiquetas y metadatos" },
];

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function PaginaDiseno() {
  return (
    <div className="min-h-dvh bg-fondo">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-white">
                <IconoEscudo className="size-5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-tenue">
                SGP Tuluá
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-titulo">
              Sistema de diseño
            </h1>
            <p className="mt-2 max-w-2xl text-base text-texto">
              Página temporal de revisión: todos los componentes con sus
              estados, la paleta y la tipografía. Úsala para validar el
              rediseño antes del commit; elimínala después (carpeta{" "}
              <span className="font-mono text-sm">src/app/design</span>).
            </p>
          </div>
          <ConmutadorTema />
        </header>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Colores"
          descripcion="Toda la plataforma usa una paleta neutra con un único acento definido en --accent, más semánticos sobrios. Ningún componente hardcodea colores."
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-tenue">
            Acento
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MuestraColor nombre="Acento" token="--accent" color="var(--accent)" />
            <MuestraColor nombre="Acento fuerte" token="--accent-fuerte" color="var(--accent-fuerte)" />
            <MuestraColor nombre="Acento activo" token="--accent-activo" color="var(--accent-activo)" />
            <MuestraColor nombre="Acento texto" token="--accent-texto" color="var(--accent-texto)" />
            <MuestraColor nombre="Acento suave" token="--accent-suave" color="var(--accent-suave)" />
          </div>

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-tenue">
            Neutros
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MuestraColor nombre="Fondo" token="--fondo" color="var(--fondo)" />
            <MuestraColor nombre="Superficie" token="--superficie" color="var(--superficie)" />
            <MuestraColor nombre="Elevada" token="--elevada" color="var(--elevada)" />
            <MuestraColor nombre="Borde" token="--borde" color="var(--borde)" />
            <MuestraColor nombre="Borde fuerte" token="--borde-fuerte" color="var(--borde-fuerte)" />
            <MuestraColor nombre="Título" token="--titulo" color="var(--titulo)" />
            <MuestraColor nombre="Texto" token="--texto" color="var(--texto)" />
            <MuestraColor nombre="Tenue" token="--tenue" color="var(--tenue)" />
            <MuestraColor nombre="Interacción" token="--interaccion" color="var(--interaccion)" />
            <MuestraColor nombre="Velo" token="--velo" color="var(--velo)" />
          </div>

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-tenue">
            Semánticos
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MuestraColor nombre="Éxito" token="--exito-texto" color="var(--exito-texto)" />
            <MuestraColor nombre="Advertencia" token="--advertencia-texto" color="var(--advertencia-texto)" />
            <MuestraColor nombre="Peligro" token="--peligro-texto" color="var(--peligro-texto)" />
            <MuestraColor nombre="Info" token="--info-texto" color="var(--info-texto)" />
            <MuestraColor nombre="Éxito suave" token="--exito-suave" color="var(--exito-suave)" />
            <MuestraColor nombre="Advertencia suave" token="--advertencia-suave" color="var(--advertencia-suave)" />
            <MuestraColor nombre="Peligro suave" token="--peligro-suave" color="var(--peligro-suave)" />
            <MuestraColor nombre="Info suave" token="--info-suave" color="var(--info-suave)" />
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Tipografía"
          descripcion="Inter para la interfaz y JetBrains Mono para código, cargadas con next/font. Escala densa de 12 a 48 px y pesos 400/500/600 (650 para titulares grandes)."
        >
          <div className="space-y-3 rounded-xl border border-borde bg-superficie p-5">
            {ESCALA_TIPOGRAFIA.map((paso) => (
              <div key={paso.clase} className="flex items-baseline gap-4">
                <span className="w-28 shrink-0 font-mono text-xs text-tenue">
                  {paso.px}px · {paso.uso}
                </span>
                <span className={`${paso.clase} truncate font-semibold text-titulo`}>
                  Gestión del espacio público
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-borde bg-superficie p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-tenue">
                Pesos
              </h3>
              <div className="mt-3 space-y-2 text-base">
                <p className="font-normal text-texto">Regular — 400</p>
                <p className="font-medium text-texto">Medium — 500</p>
                <p className="font-semibold text-titulo">Semibold — 600</p>
                <p className="font-bold text-titulo">Bold — 600</p>
                <p className="font-extrabold text-titulo">Extrabold — 650</p>
              </div>
            </div>
            <div className="rounded-xl border border-borde bg-superficie p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-tenue">
                Mono (JetBrains Mono)
              </h3>
              <p className="mt-3 font-mono text-sm text-texto">
                const zona = await importarZona(&quot;.geojson&quot;);
              </p>
              <p className="mt-2 font-mono text-sm text-tenue">
                # comando de despliegue
              </p>
              <p className="mt-2 font-mono text-sm text-texto">
                pnpm build &amp;&amp; pnpm start
              </p>
            </div>
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Botones"
          descripcion="Variantes sólido / contorno / fantasma / peligro con tamaños sm / md / lg. Todos con hover, focus-visible, disabled y estado de carga."
        >
          <div className="space-y-6 rounded-xl border border-borde bg-superficie p-5">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-tenue">
                Variantes
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Boton variante="solido">Primario</Boton>
                <Boton variante="contorno">Secundario</Boton>
                <Boton variante="fantasma">Fantasma</Boton>
                <Boton variante="peligro">Peligro</Boton>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-tenue">
                Tamaños
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Boton variante="solido" tamano="sm">
                  Pequeño
                </Boton>
                <Boton variante="solido" tamano="md">
                  Mediano
                </Boton>
                <Boton variante="solido" tamano="lg">
                  Grande
                </Boton>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-tenue">
                Con icono
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Boton variante="solido">
                  <IconoCheck className="size-4" />
                  Guardar cambios
                </Boton>
                <Boton variante="fantasma">
                  <IconoPersona className="size-4" />
                  Ver perfil
                </Boton>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-tenue">
                Cargando
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Boton variante="solido" cargando>
                  Guardando…
                </Boton>
                <Boton variante="peligro" cargando>
                  Eliminando…
                </Boton>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-tenue">
                Deshabilitado
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Boton variante="solido" disabled>
                  Primario
                </Boton>
                <Boton variante="contorno" disabled>
                  Secundario
                </Boton>
                <Boton variante="fantasma" disabled>
                  Fantasma
                </Boton>
                <Boton variante="peligro" disabled>
                  Peligro
                </Boton>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-tenue">
                Ancho completo
              </h3>
              <Boton variante="contorno" anchoCompleto className="mt-3">
                Descargar informe
              </Boton>
            </div>
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Campos de formulario"
          descripcion="Campo, Selector y CampoPassword con ayuda, error, deshabilitado y toggle de visibilidad. La flecha del selector es un icono, no una imagen incrustada."
        >
          <div className="grid gap-5 rounded-xl border border-borde bg-superficie p-5 md:grid-cols-2">
            <Campo
              etiqueta="Nombre comercial"
              ayuda="Como aparecerá en el permiso con QR."
              placeholder="Fruver La Esperanza"
            />
            <Campo
              etiqueta="NIT"
              error="El NIT debe tener 9 dígitos."
              placeholder="900123456"
              requerido
            />
            <Campo etiqueta="Ciudad" defaultValue="Tuluá" disabled />
            <Selector etiqueta="Zona asignada" defaultValue="">
              <option value="" disabled>
                Selecciona una zona…
              </option>
              <option value="centro">Centro</option>
              <option value="parque">Parque principal</option>
              <option value="carrera-25">Carrera 25</option>
            </Selector>
            <CampoPassword etiqueta="Contraseña" requerido />
            <div className="self-end">
              <Tooltip contenido="Los campos validan al enviar">
                <Boton variante="solido" tamano="md">
                  Enviar formulario
                </Boton>
              </Tooltip>
            </div>
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Tarjetas"
          descripcion="Tarjeta con encabezado, cuerpo y pie. Sombra suave de dos capas y radio de 12 px."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Tarjeta>
              <TarjetaEncabezado>
                <h3 className="text-base font-semibold text-titulo">
                  Módulo M-104
                </h3>
                <p className="mt-0.5 text-sm text-texto">
                  Carrera 25 con calle 8 · comercio de frutas
                </p>
              </TarjetaEncabezado>
              <TarjetaCuerpo className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Etiqueta tono="exitoso">Activo</Etiqueta>
                  <Etiqueta tono="info">Con QR</Etiqueta>
                </div>
                <p className="text-sm text-texto">
                  Censo actualizado el 12 de noviembre de 2026. Titular:
                  María Fernández.
                </p>
              </TarjetaCuerpo>
              <TarjetaPie>
                <div className="flex justify-center gap-2">
                  <Boton variante="fantasma" tamano="sm">
                    Ver historial
                  </Boton>
                  <Boton variante="contorno" tamano="sm">
                    Editar
                  </Boton>
                </div>
              </TarjetaPie>
            </Tarjeta>

            <Tarjeta className="p-5">
              <h3 className="text-base font-semibold text-titulo">
                Tarjeta simple
              </h3>
              <p className="mt-2 text-sm text-texto">
                Contenedor neutro para bloques de contenido sin encabezado ni
                pie: ideal para formularios y filtros.
              </p>
              <div className="mt-4">
                <EsqueletoTexto lineas={3} />
              </div>
            </Tarjeta>
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Etiquetas y estados"
          descripcion="Badges con tonos semánticos y etiquetas de estado de usuario/organización."
        >
          <div className="space-y-4 rounded-xl border border-borde bg-superficie p-5">
            <div className="flex flex-wrap gap-2">
              <Etiqueta tono="exitoso">Exitoso</Etiqueta>
              <Etiqueta tono="pendiente">Pendiente</Etiqueta>
              <Etiqueta tono="peligro">Peligro</Etiqueta>
              <Etiqueta tono="info">Info</Etiqueta>
              <Etiqueta tono="neutro">Neutro</Etiqueta>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-borde pt-4">
              <EtiquetaEstado estado="activa" />
              <EtiquetaEstado estado="pendiente_activacion" />
              <EtiquetaEstado estado="suspendida" />
              <EtiquetaEstado estado="inactiva" />
            </div>
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Alertas"
          descripcion="Mensajes de sistema con icono y tono semántico."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Alerta tono="exito">La solicitud se radicó con el número S-2026-0142.</Alerta>
            <Alerta tono="error">No fue posible cargar las zonas. Revisa tu conexión.</Alerta>
            <Alerta tono="advertencia">
              La feria «Mercado Campesino» inicia en 3 días y aún no tiene espacios asignados.
            </Alerta>
            <Alerta tono="informacion">
              El censo de módulos se sincroniza cada noche a las 2:00 a. m.
            </Alerta>
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Pestañas"
          descripcion="Barra de pestañas accesible: rols tablist/tab/tabpanel, flechas del teclado y subrayado de acento."
        >
          <div className="rounded-xl border border-borde bg-superficie p-5">
            <DemoPestanas />
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Modal"
          descripcion="Diálogo con Escape, clic fuera para cerrar y acciones de confirmación."
        >
          <div className="rounded-xl border border-borde bg-superficie p-5">
            <DemoModal />
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Tooltips"
          descripcion="Sin JavaScript: aparecen al pasar el cursor o al enfocar con teclado. Cuatro posiciones."
        >
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-borde bg-superficie p-5">
            <Tooltip contenido="Se muestra arriba">
              <Boton variante="contorno" tamano="sm">Arriba</Boton>
            </Tooltip>
            <Tooltip contenido="Se muestra abajo" lado="abajo">
              <Boton variante="contorno" tamano="sm">Abajo</Boton>
            </Tooltip>
            <Tooltip contenido="Se muestra a la izquierda" lado="izquierda">
              <Boton variante="contorno" tamano="sm">Izquierda</Boton>
            </Tooltip>
            <Tooltip contenido="Se muestra a la derecha" lado="derecha">
              <Boton variante="contorno" tamano="sm">Derecha</Boton>
            </Tooltip>
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Esqueletos de carga"
          descripcion="Estados de carga con animación de pulso, respetando prefers-reduced-motion."
        >
          <div className="space-y-4 rounded-xl border border-borde bg-superficie p-5">
            <div className="flex items-center gap-3">
              <EsqueletoCircular />
              <div className="flex-1 space-y-2">
                <Esqueleto className="h-3 w-1/3" />
                <Esqueleto className="h-3 w-2/3" />
              </div>
            </div>
            <EsqueletoTexto lineas={4} />
            <div className="flex gap-2">
              <Esqueleto className="h-10 w-24 rounded-lg" />
              <Esqueleto className="h-10 w-24 rounded-lg" />
            </div>
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Vacio, cargando y error"
          descripcion="Los tres estados obligatorios de cada vista: vacío con acción, carga y error con reintento."
        >
          <div className="grid gap-5 md:grid-cols-3">
            <Tarjeta>
              <EstadoVacio
                titulo="Sin solicitudes"
                descripcion="Cuando el comerciante no tenga solicitudes radicadas verá este estado."
                accion={<Boton variante="contorno" tamano="sm">Crear solicitud</Boton>}
              />
            </Tarjeta>
            <Tarjeta>
              <Cargando />
            </Tarjeta>
            <Tarjeta>
              <div className="p-5">
                <DemoBloqueError />
              </div>
            </Tarjeta>
          </div>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Tabla y paginación"
          descripcion="Tabla densa con encabezados uppercase y paginación con botones deshabilitados en los extremos."
        >
          <Tarjeta>
            <Tabla>
              <thead>
                <tr>
                  <Th>Módulo</Th>
                  <Th>Zona</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>
                    <span className="font-mono text-sm">M-104</span>
                  </Td>
                  <Td>Carrera 25 con calle 8</Td>
                  <Td>
                    <Etiqueta tono="exitoso">Activo</Etiqueta>
                  </Td>
                </tr>
                <tr>
                  <Td>
                    <span className="font-mono text-sm">M-205</span>
                  </Td>
                  <Td>Parque principal</Td>
                  <Td>
                    <Etiqueta tono="pendiente">En revisión</Etiqueta>
                  </Td>
                </tr>
                <tr>
                  <Td>
                    <span className="font-mono text-sm">C-311</span>
                  </Td>
                  <Td>Calle 9</Td>
                  <Td>
                    <Etiqueta tono="peligro">Suspendido</Etiqueta>
                  </Td>
                </tr>
              </tbody>
            </Tabla>
            <DemoPaginacion />
          </Tarjeta>
        </Seccion>

        {/* ---------------------------------------------------------- */}
        <Seccion
          titulo="Bloques de código"
          descripcion="Mono, nombre de archivo y botón de copiar con confirmación visual. Fondo oscuro en ambos modos, como referencia de código."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <BloqueCodigo
              nombreArchivo="src/app/layout.tsx"
              codigo={`import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });`}
            />
            <BloqueCodigo
              nombreArchivo="despliegue.sh"
              codigo={`pnpm install
pnpm build
pnpm start -p 3001`}
            />
          </div>
        </Seccion>

        <footer className="mt-14 border-t border-borde pt-6 text-sm text-tenue">
          Página temporal para revisión del sistema de diseño. Al terminar,
          elimina la carpeta <span className="font-mono">src/app/design</span>{" "}
          antes del commit o pásala a modo privado.
        </footer>
      </div>
    </div>
  );
}
