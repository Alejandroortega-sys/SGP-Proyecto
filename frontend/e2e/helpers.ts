import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API_URL = 'http://localhost:3000';

export const CREDENCIALES = {
  administrador: { correo: 'admin@tulua.gov.co', password: 'Admin1234' },
  revisor: { correo: 'revisor@tulua.gov.co', password: 'Admin1234' },
  comerciante: { correo: 'maria.gomez@gmail.com', password: 'Comerciante123' },
  comerciante2: {
    correo: 'jose.perez@hotmail.com',
    password: 'Comerciante123',
  },
  organizador: {
    correo: 'luis.alvarez@agrovalle.org',
    password: 'Organizador123',
  },
} as const;

/**
 * Localiza un campo por el inicio de su etiqueta. Los campos obligatorios
 * añaden un asterisco al texto de la etiqueta, por eso no se usa `exact`.
 */
export function campo(page: Page, texto: string) {
  const escapado = texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.getByLabel(new RegExp(`^${escapado}`));
}

export async function iniciarSesion(
  page: Page,
  correo: string,
  password: string,
  rutaEsperada: string,
): Promise<void> {
  await page.goto('/login');
  await campo(page, 'Correo electrónico').fill(correo);
  await campo(page, 'Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.waitForURL(`**${rutaEsperada}`);
  await page.waitForLoadState('networkidle');
}

export async function cerrarSesion(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Cerrar sesión', exact: true })
    .click();
  await page.waitForURL('**/login');
}

export async function tokenSesion(page: Page): Promise<string> {
  const token = await page.evaluate(() =>
    window.sessionStorage.getItem('sgp.accessToken'),
  );
  if (!token) throw new Error('No hay access token en sessionStorage.');
  return token;
}

/** Inicia sesión contra la API y devuelve el access token. */
export async function iniciarSesionApi(
  request: APIRequestContext,
  correo: string,
  password: string,
): Promise<string> {
  const respuesta = await request.post(`${API_URL}/auth/login`, {
    data: { correo, password },
  });
  expect(respuesta.ok()).toBeTruthy();
  const cuerpo = (await respuesta.json()) as { accessToken: string };
  return cuerpo.accessToken;
}

/** Cambia el estado no final de una solicitud como gestor. */
export async function cambiarEstadoSolicitudApi(
  request: APIRequestContext,
  token: string,
  solicitudId: string,
  estado: 'en_revision' | 'devuelta',
  extra: { observacion?: string } = {},
): Promise<void> {
  const respuesta = await request.patch(
    `${API_URL}/gestor/solicitudes/${solicitudId}/estado`,
    {
      ...cabecerasApi(token),
      data: { estado, ...extra },
    },
  );
  expect(respuesta.ok()).toBeTruthy();
}

/** Aprueba o rechaza una solicitud revisada (HU-20). */
export function resolverSolicitudApi(
  request: APIRequestContext,
  token: string,
  solicitudId: string,
  datos: {
    decision: 'aprobar' | 'rechazar';
    dictamen?: string;
    motivoRechazo?: string;
  },
) {
  return request.patch(
    `${API_URL}/gestor/solicitudes/${solicitudId}/resolucion`,
    {
      ...cabecerasApi(token),
      data: datos,
    },
  );
}

/** Toma el bloqueo de revisión de una solicitud. */
export function tomarRevisionApi(
  request: APIRequestContext,
  token: string,
  solicitudId: string,
) {
  return request.post(
    `${API_URL}/gestor/solicitudes/${solicitudId}/revision`,
    cabecerasApi(token),
  );
}

/** Obtiene el detalle de una solicitud como gestor. */
export function obtenerSolicitudRevisionApi(
  request: APIRequestContext,
  token: string,
  solicitudId: string,
) {
  return request.get(
    `${API_URL}/gestor/solicitudes/${solicitudId}`,
    cabecerasApi(token),
  );
}

/** Obtiene el detalle de una solicitud como comerciante dueño. */
export function obtenerMiSolicitudApi(
  request: APIRequestContext,
  token: string,
  solicitudId: string,
) {
  return request.get(`${API_URL}/solicitudes/${solicitudId}`, cabecerasApi(token));
}

/** Radica una solicitud con documentos por la API, sin recorrer el formulario. */
export async function radicarSolicitudApi(
  request: APIRequestContext,
  token: string,
  datos: {
    espacioId: string;
    actividad: string;
    productoIds: string[];
    fechaInicio: string;
    fechaFin: string;
    horaInicio: string;
    horaFin: string;
  },
  documentos: Array<{
    requisitoId: string;
    nombreOriginal: string;
    buffer: Buffer;
  }>,
): Promise<{ id: string; numeroRadicado: string }> {
  const formulario = new FormData();
  formulario.append('datos', JSON.stringify(datos));
  formulario.append(
    'documentosMeta',
    JSON.stringify(
      documentos.map(({ requisitoId, nombreOriginal }) => ({
        requisitoId,
        nombreOriginal,
      })),
    ),
  );
  for (const documento of documentos) {
    formulario.append(
      'documentos',
      new Blob([new Uint8Array(documento.buffer)], {
        type: 'application/pdf',
      }),
      documento.nombreOriginal,
    );
  }

  const respuesta = await request.post(`${API_URL}/solicitudes`, {
    ...cabecerasApi(token),
    multipart: formulario,
  });
  if (!respuesta.ok()) {
    throw new Error(
      `No se pudo radicar la solicitud (${respuesta.status()}): ${await respuesta.text()}`,
    );
  }
  return (await respuesta.json()) as { id: string; numeroRadicado: string };
}

export function cabecerasApi(token: string): {
  headers: Record<string, string>;
} {
  return { headers: { Authorization: `Bearer ${token}` } };
}

/** Zonas y productos disponibles para radicar una feria. */
export async function obtenerOpcionesFeriaApi(
  request: APIRequestContext,
  token: string,
): Promise<{
  zonas: Array<{
    id: string;
    nombre: string;
    aforoMaximo: number | null;
    productosPermitidos: string[];
  }>;
  productos: Array<{ id: string; nombre: string }>;
}> {
  const respuesta = await request.get(`${API_URL}/ferias/zonas`, {
    ...cabecerasApi(token),
  });
  expect(respuesta.ok()).toBeTruthy();
  return (await respuesta.json()) as {
    zonas: Array<{
      id: string;
      nombre: string;
      aforoMaximo: number | null;
      productosPermitidos: string[];
    }>;
    productos: Array<{ id: string; nombre: string }>;
  };
}

/** Radica una feria por la API para preparar un escenario de calendario. */
export async function crearFeriaApi(
  request: APIRequestContext,
  token: string,
  datos: {
    nombre: string;
    tipoFeria: string;
    zonaId: string;
    fechaInicio: string;
    fechaFin: string;
    numeroPuestos: number;
    productoIds: string[];
  },
): Promise<{ id: string; numeroRadicado: string }> {
  const formulario = new FormData();
  formulario.append('datos', JSON.stringify(datos));
  const respuesta = await request.post(`${API_URL}/ferias`, {
    ...cabecerasApi(token),
    multipart: formulario,
  });
  if (!respuesta.ok()) {
    throw new Error(
      `No se pudo crear la feria de prueba (${respuesta.status()}): ${await respuesta.text()}`,
    );
  }
  return (await respuesta.json()) as { id: string; numeroRadicado: string };
}

/** Aprueba una feria por la API para preparar un escenario de participantes. */
export async function aprobarFeriaApi(
  request: APIRequestContext,
  token: string,
  feriaId: string,
): Promise<void> {
  const respuesta = await request.post(
    `${API_URL}/gestor/ferias/${feriaId}/aprobar`,
    cabecerasApi(token),
  );
  if (!respuesta.ok()) {
    throw new Error(
      `No se pudo aprobar la feria de prueba (${respuesta.status()}): ${await respuesta.text()}`,
    );
  }
}

/** Consulta los espacios con su disponibilidad efectiva en una fecha. */
export async function obtenerEspaciosApi(
  request: APIRequestContext,
  token: string,
  fecha: string,
): Promise<
  Array<{
    id: string;
    nombre: string;
    disponible: boolean;
    estadoEfectivo: string;
    motivoEstado: string | null;
    zona: { id: string; nombre: string } | null;
  }>
> {
  const respuesta = await request.get(
    `${API_URL}/espacios?fecha=${fecha}&incluirNoDisponibles=true`,
    cabecerasApi(token),
  );
  expect(respuesta.ok()).toBeTruthy();
  const cuerpo = (await respuesta.json()) as {
    datos: Array<{
      id: string;
      nombre: string;
      disponible: boolean;
      estadoEfectivo: string;
      motivoEstado: string | null;
      zona: { id: string; nombre: string } | null;
    }>;
  };
  return cuerpo.datos;
}

export async function obtenerNotificaciones(
  request: APIRequestContext,
  token: string,
  soloNoLeidas = false,
): Promise<
  Array<{
    id: string;
    leida: boolean;
    asunto: string;
    cuerpo: string | null;
    solicitudId: string | null;
    feriaId: string | null;
  }>
> {
  const url = `${API_URL}/notificaciones?limite=20${soloNoLeidas ? '&leida=false' : ''}`;
  const respuesta = await request.get(url, cabecerasApi(token));
  expect(respuesta.ok()).toBeTruthy();
  const cuerpo = (await respuesta.json()) as {
    datos: Array<{
      id: string;
      leida: boolean;
      asunto: string;
      cuerpo: string | null;
      solicitudId: string | null;
      feriaId: string | null;
    }>;
  };
  return cuerpo.datos;
}

export async function marcarNotificacionApi(
  request: APIRequestContext,
  token: string,
  id: string,
  leida: boolean,
): Promise<void> {
  const respuesta = await request.patch(
    `${API_URL}/notificaciones/${id}/leida`,
    {
      ...cabecerasApi(token),
      data: { leida },
    },
  );
  expect(respuesta.ok()).toBeTruthy();
}
