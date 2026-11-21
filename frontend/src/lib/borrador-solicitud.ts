/**
 * Borrador local del formulario de solicitud.
 *
 * El backend no guarda borradores. Los campos viajan en `sessionStorage` y
 * los archivos en `IndexedDB`, porque `sessionStorage` no puede almacenar
 * objetos `File`/`Blob`. Al cerrar sesión se elimina todo.
 */

const PREFIJO_CLAVE = "sgp.borradorSolicitud.";
const NOMBRE_BD = "sgp-borrador-solicitud";
const ALMACEN_ARCHIVOS = "archivos";
const VERSION_BD = 1;

export interface BorradorSolicitudCampos {
  espacioId: string;
  actividad: string;
  productoIds: string[];
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  paso: number;
  actualizadoEn: string;
}

export interface ArchivoBorradorSolicitud {
  requisitoId: string;
  nombre: string;
  tipo: string;
  tamano: number;
  blob: Blob;
}

function claveBorrador(usuarioId: string): string {
  return `${PREFIJO_CLAVE}${usuarioId}`;
}

function storageDisponible(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.sessionStorage);
  } catch {
    return false;
  }
}

/** Guarda los campos del borrador en la sesión del navegador. */
export function guardarBorradorCampos(
  usuarioId: string,
  borrador: BorradorSolicitudCampos,
): void {
  if (!storageDisponible()) return;
  try {
    window.sessionStorage.setItem(
      claveBorrador(usuarioId),
      JSON.stringify(borrador),
    );
  } catch {
    // Sin espacio o almacenamiento bloqueado: el formulario sigue funcionando.
  }
}

/** Recupera los campos del borrador de la sesión del navegador. */
export function leerBorradorCampos(
  usuarioId: string,
): BorradorSolicitudCampos | null {
  if (!storageDisponible()) return null;
  try {
    const crudo = window.sessionStorage.getItem(claveBorrador(usuarioId));
    if (!crudo) return null;
    return normalizarBorrador(JSON.parse(crudo) as unknown);
  } catch {
    return null;
  }
}

/** Elimina los campos del borrador de la sesión del navegador. */
export function limpiarBorradorCampos(usuarioId: string): void {
  if (!storageDisponible()) return;
  try {
    window.sessionStorage.removeItem(claveBorrador(usuarioId));
  } catch {
    // Nada que hacer.
  }
}

/**
 * Valida y normaliza el JSON leído de `sessionStorage`. Un borrador viejo o
 * corrupto se descarta en lugar de romper el formulario.
 */
export function normalizarBorrador(
  valor: unknown,
): BorradorSolicitudCampos | null {
  if (typeof valor !== "object" || valor === null) return null;
  const registro = valor as Record<string, unknown>;

  const texto = (campo: string): string =>
    typeof registro[campo] === "string" ? (registro[campo] as string) : "";
  const productos = Array.isArray(registro.productoIds)
    ? registro.productoIds.filter(
        (id): id is string => typeof id === "string",
      )
    : [];
  const paso = typeof registro.paso === "number" ? registro.paso : 1;

  const borrador: BorradorSolicitudCampos = {
    espacioId: texto("espacioId"),
    actividad: texto("actividad"),
    productoIds: productos,
    fechaInicio: texto("fechaInicio"),
    fechaFin: texto("fechaFin"),
    horaInicio: texto("horaInicio"),
    horaFin: texto("horaFin"),
    paso: Math.min(5, Math.max(1, paso)),
    actualizadoEn: texto("actualizadoEn"),
  };

  const tieneDatos =
    borrador.espacioId ||
    borrador.actividad ||
    borrador.productoIds.length > 0 ||
    borrador.fechaInicio ||
    borrador.fechaFin ||
    borrador.horaInicio ||
    borrador.horaFin;

  return tieneDatos ? borrador : null;
}

function abrirBd(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolver) => {
    try {
      const solicitud = window.indexedDB.open(NOMBRE_BD, VERSION_BD);
      solicitud.onupgradeneeded = () => {
        const bd = solicitud.result;
        if (!bd.objectStoreNames.contains(ALMACEN_ARCHIVOS)) {
          const almacen = bd.createObjectStore(ALMACEN_ARCHIVOS, {
            keyPath: "id",
          });
          almacen.createIndex("usuarioId", "usuarioId", { unique: false });
        }
      };
      solicitud.onsuccess = () => resolver(solicitud.result);
      solicitud.onerror = () => resolver(null);
    } catch {
      resolver(null);
    }
  });
}

interface RegistroArchivo {
  id: string;
  usuarioId: string;
  requisitoId: string;
  nombre: string;
  tipo: string;
  tamano: number;
  blob: Blob;
}

/** Guarda los archivos adjuntos del borrador en IndexedDB. */
export async function guardarArchivosBorrador(
  usuarioId: string,
  archivos: ArchivoBorradorSolicitud[],
): Promise<void> {
  const bd = await abrirBd();
  if (!bd) return;

  await new Promise<void>((resolver) => {
    const transaccion = bd.transaction(ALMACEN_ARCHIVOS, "readwrite");
    const almacen = transaccion.objectStore(ALMACEN_ARCHIVOS);
    const indice = almacen.index("usuarioId");

    const solicitudCursor = indice.openCursor(IDBKeyRange.only(usuarioId));
    solicitudCursor.onsuccess = () => {
      const cursor = solicitudCursor.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
        return;
      }

      for (const archivo of archivos) {
        almacen.put({
          id: `${usuarioId}:${archivo.requisitoId}`,
          usuarioId,
          requisitoId: archivo.requisitoId,
          nombre: archivo.nombre,
          tipo: archivo.tipo,
          tamano: archivo.tamano,
          blob: archivo.blob,
        } satisfies RegistroArchivo);
      }
    };

    transaccion.oncomplete = () => {
      bd.close();
      resolver();
    };
    transaccion.onerror = () => {
      bd.close();
      resolver();
    };
    transaccion.onabort = () => {
      bd.close();
      resolver();
    };
  });
}

/** Lee los archivos del borrador guardados en IndexedDB. */
export async function leerArchivosBorrador(
  usuarioId: string,
): Promise<ArchivoBorradorSolicitud[]> {
  const bd = await abrirBd();
  if (!bd) return [];

  return new Promise((resolver) => {
    const transaccion = bd.transaction(ALMACEN_ARCHIVOS, "readonly");
    const indice = transaccion.objectStore(ALMACEN_ARCHIVOS).index("usuarioId");
    const solicitud = indice.getAll(IDBKeyRange.only(usuarioId));

    solicitud.onsuccess = () => {
      const registros = (solicitud.result ?? []) as RegistroArchivo[];
      resolver(
        registros
          .filter((registro) => registro.blob instanceof Blob)
          .map((registro) => ({
            requisitoId: registro.requisitoId,
            nombre: registro.nombre,
            tipo: registro.tipo,
            tamano: registro.tamano,
            blob: registro.blob,
          })),
      );
    };
    solicitud.onerror = () => resolver([]);
  });
}

/** Elimina el borrador completo de un usuario. */
export async function limpiarBorrador(usuarioId: string): Promise<void> {
  limpiarBorradorCampos(usuarioId);

  const bd = await abrirBd();
  if (!bd) return;

  await new Promise<void>((resolver) => {
    const transaccion = bd.transaction(ALMACEN_ARCHIVOS, "readwrite");
    const almacen = transaccion.objectStore(ALMACEN_ARCHIVOS);
    const indice = almacen.index("usuarioId");
    const solicitud = indice.openCursor(IDBKeyRange.only(usuarioId));

    solicitud.onsuccess = () => {
      const cursor = solicitud.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };

    transaccion.oncomplete = () => {
      bd.close();
      resolver();
    };
    transaccion.onerror = () => {
      bd.close();
      resolver();
    };
  });
}

/**
 * Elimina todos los borradores locales.
 *
 * Se invoca al cerrar sesión o cuando el backend invalida la sesión. No
 * espera a IndexedDB para no bloquear el cierre de sesión.
 */
export function limpiarTodosLosBorradores(): void {
  if (storageDisponible()) {
    try {
      const claves: string[] = [];
      for (let indice = 0; indice < window.sessionStorage.length; indice += 1) {
        const clave = window.sessionStorage.key(indice);
        if (clave?.startsWith(PREFIJO_CLAVE)) claves.push(clave);
      }
      for (const clave of claves) {
        window.sessionStorage.removeItem(clave);
      }
    } catch {
      // Nada que hacer.
    }
  }

  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  try {
    window.indexedDB.deleteDatabase(NOMBRE_BD);
  } catch {
    // Nada que hacer.
  }
}

/** Indica si el borrador tiene algún dato relevante. */
export function borradorTieneDatos(
  borrador: BorradorSolicitudCampos | null,
): borrador is BorradorSolicitudCampos {
  return borrador !== null;
}
