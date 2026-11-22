import { expect, test } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  API_URL,
  CREDENCIALES,
  cabecerasApi,
  cambiarEstadoSolicitudApi,
  campo,
  iniciarSesion,
  iniciarSesionApi,
  obtenerNotificaciones,
  radicarSolicitudApi,
} from './helpers';
import { eliminarSolicitudesPrueba } from './limpieza-solicitudes';

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
);

const ACTIVIDAD = 'E2E SEGUIMIENTO notificaciones';

function fechaFutura(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

test.describe.configure({ mode: 'serial' });

test.describe('Seguimiento de solicitudes y notificaciones (HU-18)', () => {
  let solicitudId = '';
  let numeroRadicado = '';
  let tokenComerciante = '';
  let tokenGestor = '';

  test.beforeAll(async ({ request }) => {
    tokenComerciante = await iniciarSesionApi(
      request,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
    );
    tokenGestor = await iniciarSesionApi(
      request,
      CREDENCIALES.administrador.correo,
      CREDENCIALES.administrador.password,
    );

    const creada = await radicarSolicitudApi(
      request,
      tokenComerciante,
      {
        espacioId: '4',
        actividad: ACTIVIDAD,
        productoIds: ['3'],
        fechaInicio: fechaFutura(60),
        fechaFin: fechaFutura(62),
        horaInicio: '09:00',
        horaFin: '12:00',
      },
      [
        {
          requisitoId: '1',
          nombreOriginal: 'cedula.pdf',
          buffer: PDF,
        },
        { requisitoId: '2', nombreOriginal: 'rut.pdf', buffer: PDF },
      ],
    );
    solicitudId = creada.id;
    numeroRadicado = creada.numeroRadicado;
  });

  test.afterAll(async () => {
    const ids = await eliminarSolicitudesPrueba(
      CREDENCIALES.comerciante.correo,
      ACTIVIDAD,
    );
    for (const id of ids) {
      await rm(
        resolve(process.cwd(), '..', 'uploads-privados', 'solicitudes', id),
        { recursive: true, force: true },
      );
    }
    solicitudId = '';
  });

  test('filtra la lista por estado y muestra el detalle con línea de tiempo', async ({
    page,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      '/comerciante/inicio',
    );

    await page.goto('/comerciante/solicitudes');
    await expect(page.getByText(ACTIVIDAD).first()).toBeVisible();
    await campo(page, 'Filtrar por estado').selectOption('radicada');
    await expect(page.getByText(ACTIVIDAD).first()).toBeVisible();
    await campo(page, 'Filtrar por estado').selectOption('aprobada');
    await expect(page.getByText(ACTIVIDAD)).toHaveCount(0);

    await page.goto(`/comerciante/solicitudes/${solicitudId}`);
    await expect(
      page.getByRole('heading', { name: numeroRadicado }),
    ).toBeVisible();
    await expect(page.getByText('Historial de estados')).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Línea de tiempo de estados' }),
    ).toBeVisible();
    await expect(
      page.getByText('Radicada', { exact: true }).first(),
    ).toBeVisible();
  });

  test('el gestor cambia el estado y el comerciante recibe la notificación', async ({
    page,
    request,
  }) => {
    await cambiarEstadoSolicitudApi(
      request,
      tokenGestor,
      solicitudId,
      'en_revision',
    );
    await cambiarEstadoSolicitudApi(
      request,
      tokenGestor,
      solicitudId,
      'aprobada',
      { observacion: 'Cumple con los requisitos.' },
    );

    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      '/comerciante/inicio',
    );
    await page.goto(`/comerciante/solicitudes/${solicitudId}`);

    await expect(
      page.getByRole('list', { name: 'Línea de tiempo de estados' }),
    ).toBeVisible();
    await expect(
      page.getByText('En revisión', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Aprobada', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('Cumple con los requisitos.')).toBeVisible();
  });

  test('el centro de notificaciones enlaza la solicitud y actualiza el indicador', async ({
    page,
    request,
  }) => {
    const notificaciones = await obtenerNotificaciones(
      request,
      tokenComerciante,
    );
    const objetivo = notificaciones.find(
      (notificacion) =>
        notificacion.solicitudId === solicitudId &&
        !notificacion.leida &&
        notificacion.asunto.includes(numeroRadicado),
    );
    expect(objetivo).toBeTruthy();

    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      '/comerciante/inicio',
    );
    await page.goto('/notificaciones');

    const enlaceNotificaciones = page
      .getByRole('link', { name: /^Notificaciones/ })
      .first();
    const badgeAntes = (await enlaceNotificaciones.textContent()) ?? '';
    const numeroAntes = Number(badgeAntes.replace(/\D/g, '') || '0');
    expect(numeroAntes).toBeGreaterThan(0);

    const tarjeta = page.getByText(objetivo!.asunto, { exact: true });
    await expect(tarjeta).toBeVisible();
    const enlaceSolicitud = page.getByRole('link', {
      name: `Ver solicitud ${objetivo!.asunto}`,
    });
    await expect(enlaceSolicitud).toBeVisible();
    await enlaceSolicitud.click();
    await page.waitForURL(`**/comerciante/solicitudes/${solicitudId}`);
    await expect(
      page.getByRole('heading', { name: numeroRadicado }),
    ).toBeVisible();

    await page.goto('/notificaciones');
    await page
      .getByRole('button', {
        name: `Marcar como leída ${objetivo!.asunto}`,
      })
      .click();

    await expect
      .poll(async () => {
        const texto =
          (await enlaceNotificaciones.textContent().catch(() => '')) ?? '';
        return Number(texto.replace(/\D/g, '') || '0');
      })
      .toBeLessThan(numeroAntes);
  });

  test('no expone solicitudes ni notificaciones de otro comerciante', async ({
    page,
    request,
  }) => {
    const tokenJose = await iniciarSesionApi(
      request,
      CREDENCIALES.comerciante2.correo,
      CREDENCIALES.comerciante2.password,
    );
    const solicitudesJose = await request.get(
      `${API_URL}/solicitudes/mias?limite=50`,
      cabecerasApi(tokenJose),
    );
    const cuerpoJose = (await solicitudesJose.json()) as {
      datos: Array<{ id: string; numeroRadicado: string }>;
    };
    const ajena = cuerpoJose.datos[0];
    expect(ajena).toBeTruthy();

    await iniciarSesion(
      page,
      CREDENCIALES.comerciante.correo,
      CREDENCIALES.comerciante.password,
      '/comerciante/inicio',
    );
    await page.goto('/comerciante/solicitudes');
    await expect(page.getByText(ACTIVIDAD).first()).toBeVisible();
    await expect(page.getByText(ajena.numeroRadicado)).toHaveCount(0);

    await page.goto(`/comerciante/solicitudes/${ajena.id}`);
    await expect(
      page.getByText(/no existe o no te pertenece/i).first(),
    ).toBeVisible();

    const notificacionesPropias = await obtenerNotificaciones(
      request,
      tokenComerciante,
    );
    expect(
      notificacionesPropias.some(
        (notificacion) => notificacion.solicitudId === ajena.id,
      ),
    ).toBe(false);
  });
});
