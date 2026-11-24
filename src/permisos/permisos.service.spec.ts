import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AvisosVencimientoService } from './avisos-vencimiento.service';
import { PermisosService } from './permisos.service';

/** Gestor autenticado de las pruebas (revisor del seed). */
const GESTOR: UsuarioAutenticado = {
  id: '2',
  nombre: 'Carlos',
  apellido: 'Ramírez',
  correo: 'revisor@tulua.gov.co',
  rol: 'gestor',
  perfil: 'revisor',
  estado: 'activa',
};

/** Comerciante autenticado de las pruebas (titular del permiso). */
const COMERCIANTE: UsuarioAutenticado = {
  id: '3',
  nombre: 'María',
  apellido: 'Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'comerciante',
  perfil: null,
  estado: 'activa',
};

/** ConfigService simulado: la URL del frontend para el QR del carné. */
function crearConfigMock(): ConfigService {
  return {
    get: jest.fn().mockReturnValue('http://localhost:3001'),
  } as unknown as ConfigService;
}

/** Fecha relativa a hoy (aritmética UTC, coherente con fechaISO). */
function fechaLocal(dias: number): Date {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha;
}

/** Prisma simulado con el cliente de transacción compartido. */
function crearPrismaMock(tx: Record<string, unknown>): PrismaService {
  const prisma = {
    $transaction: jest.fn(async (fn: (cliente: unknown) => Promise<unknown>) =>
      fn(tx),
    ),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    permisos: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    permiso_eventos: { findMany: jest.fn() },
    verificaciones_qr: {
      create: jest.fn().mockResolvedValue({ id: 100n }),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    solicitudes: { count: jest.fn() },
  };
  return { ...prisma, ...tx } as unknown as PrismaService;
}

/** Cliente de transacción simulado con los mocks por defecto. */
function crearTxMock(): Record<string, jest.Mock> {
  return {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(0),
    permisos: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 8n }),
    },
    notificaciones: {
      create: jest.fn().mockResolvedValue({ id: 21n }),
    },
    solicitudes: { count: jest.fn().mockResolvedValue(0) },
    solicitud_historial: { create: jest.fn().mockResolvedValue({}) },
    cobros: {},
  };
}

/** Fila de solicitud aprobada lista para emitir el permiso. */
const SOLICITUD_APROBADA = {
  id: 12n,
  numero_radicado: 'SOL-2026-00012',
  estado: 'aprobada',
  comerciante_id: 3n,
  espacio_id: 4n,
  actividad: 'Venta de frutas y verduras',
  espacio_nombre: 'Kiosco Parque La Guadua',
  zona_id: 4n,
  titular_nombre: 'María',
  titular_apellido: 'Gómez',
};

/** Permiso devuelto por la BD tras el INSERT (número y QR generados allí). */
function permisoEmitido(
  numero: string,
  qrToken: string,
): {
  id: bigint;
  numero: string;
  qr_token: string;
  categoria_autorizada: string;
  fecha_inicio: Date;
  fecha_fin: Date;
  estado: 'vigente';
  emitido_en: Date;
} {
  return {
    id: 8n,
    numero,
    qr_token: qrToken,
    categoria_autorizada: SOLICITUD_APROBADA.actividad,
    fecha_inicio: fechaLocal(-1),
    fecha_fin: fechaLocal(29),
    estado: 'vigente',
    emitido_en: new Date('2026-11-23T10:00:00'),
  };
}

const TOKEN_A = 'a3f0c44298fc1c149afbf4c8996fb92427ae41e4649b934c';
const TOKEN_B = 'b7c1d55298fc1c149afbf4c8996fb92427ae41e4649b934d';

describe('PermisosService — emisión (HU-31)', () => {
  it('HU-31-CA1: emite con número, titular, espacio, vigencia, categoría y QR', async () => {
    const tx = crearTxMock();
    tx.$queryRaw
      .mockResolvedValueOnce([SOLICITUD_APROBADA])
      .mockResolvedValueOnce([permisoEmitido('PER-2026-00002', TOKEN_A)])
      .mockResolvedValueOnce([{ id: 1n, valor: 50000 }])
      .mockResolvedValueOnce([{ id: 1n, valor: 50000, estado: 'pendiente' }]);
    tx.permisos.findUnique.mockResolvedValue(null);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    const respuesta = await service.emitir(GESTOR, { solicitudId: '12' });

    expect(respuesta.numero).toBe('PER-2026-00002');
    expect(respuesta.titular).toEqual({ id: '3', nombre: 'María Gómez' });
    expect(respuesta.espacio).toEqual({
      id: '4',
      nombre: 'Kiosco Parque La Guadua',
    });
    expect(respuesta.categoria).toBe('Venta de frutas y verduras');
    expect(respuesta.estado).toBe('vigente');
    expect(respuesta.qrToken).toBe(TOKEN_A);
    expect(respuesta.cobro).toEqual({
      id: '1',
      valor: '50000',
      estado: 'pendiente',
      pagadoEn: null,
    });
    // El actor de sesión se fija dentro de la transacción antes de escribir.
    const plantillaActor = tx.$executeRaw.mock
      .calls[0]?.[0] as readonly string[];
    expect(plantillaActor?.join('?')).toContain('app.actor_id');
    expect(tx.$executeRaw.mock.calls[0]?.[1]).toBe('2');
    // La emisión notifica al titular (CA3) sin enviar el campo del número.
    expect(tx.notificaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuario_id: 3n,
          solicitud_id: 12n,
          tipo: 'permiso_emitido',
          canal: 'app',
        }),
      }),
    );
  });

  it('HU-31-CA2: dos emisiones traen QR distintos e impredecibles de la BD', async () => {
    const tx = crearTxMock();
    tx.$queryRaw
      .mockResolvedValueOnce([SOLICITUD_APROBADA])
      .mockResolvedValueOnce([permisoEmitido('PER-2026-00002', TOKEN_A)])
      // Sin tarifa aplicable: no se crea cobro.
      .mockResolvedValueOnce([]);
    tx.permisos.findUnique.mockResolvedValue(null);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    const primera = await service.emitir(GESTOR, { solicitudId: '12' });

    const tx2 = crearTxMock();
    tx2.$queryRaw
      .mockResolvedValueOnce([SOLICITUD_APROBADA])
      .mockResolvedValueOnce([permisoEmitido('PER-2026-00003', TOKEN_B)])
      .mockResolvedValueOnce([]);
    tx2.permisos.findUnique.mockResolvedValue(null);
    const service2 = new PermisosService(
      crearPrismaMock(tx2),
      crearConfigMock(),
    );
    const segunda = await service2.emitir(GESTOR, { solicitudId: '12' });

    expect(primera.qrToken).not.toBe(segunda.qrToken);
    expect(primera.cobro).toBeNull();
    // El número, el token QR y la fecha de emisión nunca se envían en el
    // INSERT de la emisión: los genera la BD (AGENTS §6).
    const plantillaInsert = (tx.$queryRaw.mock.calls[1]?.[0] ??
      []) as readonly string[];
    const sql = plantillaInsert.join('?');
    const inicio =
      sql.indexOf('INSERT INTO permisos (') + 'INSERT INTO permisos ('.length;
    const fin = sql.indexOf(')', inicio);
    const columnas = sql.slice(inicio, fin);
    expect(columnas).not.toContain('qr_token');
    expect(columnas).not.toContain('numero');
    expect(columnas).not.toContain('emitido_en');
  });

  it('HU-31-CA4: una solicitud no aprobada no permite emitir (422)', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValue([
      { ...SOLICITUD_APROBADA, estado: 'radicada' },
    ]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    await expect(service.emitir(GESTOR, { solicitudId: '12' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(service.emitir(GESTOR, { solicitudId: '12' })).rejects.toThrow(
      /solicitudes aprobadas/,
    );
  });

  it('HU-31: la solicitud inexistente responde 404', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValue([]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    await expect(
      service.emitir(GESTOR, { solicitudId: '999' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('HU-31: una solicitud que ya tiene permiso responde 409', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValueOnce([SOLICITUD_APROBADA]);
    tx.permisos.findUnique.mockResolvedValueOnce({
      numero: 'PER-2026-00002',
    });
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    await expect(service.emitir(GESTOR, { solicitudId: '12' })).rejects.toThrow(
      ConflictException,
    );
    expect(tx.notificaciones.create).not.toHaveBeenCalled();
  });

  it('HU-31: una solicitud aprobada sin espacio asignado responde 422', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValueOnce([
      { ...SOLICITUD_APROBADA, espacio_id: null },
    ]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    await expect(service.emitir(GESTOR, { solicitudId: '12' })).rejects.toThrow(
      /espacio asignado/,
    );
  });

  it('HU-34: la emisión de una renovación enlaza el permiso de origen', async () => {
    const tx = crearTxMock();
    tx.$queryRaw
      .mockResolvedValueOnce([SOLICITUD_APROBADA])
      .mockResolvedValueOnce([
        { id: 7n, numero: 'PER-2026-00001', titular_id: 3n },
      ])
      .mockResolvedValueOnce([permisoEmitido('PER-2026-00009', TOKEN_A)])
      .mockResolvedValueOnce([{ id: 1n, valor: 50000 }])
      .mockResolvedValueOnce([{ id: 1n, valor: 50000, estado: 'pendiente' }]);
    tx.permisos.findUnique.mockResolvedValue(null);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    const respuesta = await service.emitir(GESTOR, {
      solicitudId: '12',
      renovadoDesde: '7',
    });

    expect(respuesta.renovadoDesde).toEqual({
      id: '7',
      numero: 'PER-2026-00001',
    });
  });

  it('HU-34: el permiso de origen de otro titular rechaza la emisión (422)', async () => {
    const tx = crearTxMock();
    tx.$queryRaw
      .mockResolvedValueOnce([SOLICITUD_APROBADA])
      .mockResolvedValueOnce([
        { id: 7n, numero: 'PER-2026-00001', titular_id: 9n },
      ]);
    tx.permisos.findUnique.mockResolvedValue(null);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    await expect(
      service.emitir(GESTOR, { solicitudId: '12', renovadoDesde: '7' }),
    ).rejects.toThrow(/otro titular/);
  });
});

describe('PermisosService — estados (HU-35)', () => {
  it('HU-35-CA1: suspende con motivo y notifica al titular', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 8n,
        numero: 'PER-2026-00008',
        estado: 'vigente',
        titular_id: 3n,
        titular_nombre: 'María',
        titular_apellido: 'Gómez',
      },
    ]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    const respuesta = await service.cambiarEstado(GESTOR, '8', {
      estado: 'suspendido',
      motivo: 'Reporte de inspección: horario excedido',
    });

    expect(respuesta.estadoAnterior).toBe('vigente');
    expect(respuesta.estado).toBe('suspendido');
    expect(respuesta.motivo).toBe('Reporte de inspección: horario excedido');
    // El motivo viaja a la BD por variable de sesión antes del UPDATE.
    const plantillaMotivo = tx.$executeRaw.mock
      .calls[1]?.[0] as readonly string[];
    expect(plantillaMotivo?.join('?')).toContain('app.motivo');
    expect(tx.$executeRaw.mock.calls[1]?.[1]).toBe(
      'Reporte de inspección: horario excedido',
    );
    expect(tx.permisos.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estado: 'suspendido' } }),
    );
    expect(tx.notificaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'permiso_suspendido',
          usuario_id: 3n,
        }),
      }),
    );
  });

  it('HU-35-CA2: levanta la suspensión y vuelve a vigente', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 8n,
        numero: 'PER-2026-00008',
        estado: 'suspendido',
        titular_id: 3n,
        titular_nombre: 'María',
        titular_apellido: 'Gómez',
      },
    ]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    const respuesta = await service.cambiarEstado(GESTOR, '8', {
      estado: 'vigente',
      motivo: 'Levantado por la Secretaría de Gobierno',
    });

    expect(respuesta.estado).toBe('vigente');
    expect(tx.permisos.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estado: 'vigente' } }),
    );
    expect(tx.notificaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'permiso_reactivado' }),
      }),
    );
  });

  it('HU-35-CA1: revoca un permiso vigente con motivo obligatorio', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 8n,
        numero: 'PER-2026-00008',
        estado: 'vigente',
        titular_id: 3n,
        titular_nombre: 'María',
        titular_apellido: 'Gómez',
      },
    ]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    const respuesta = await service.cambiarEstado(GESTOR, '8', {
      estado: 'revocado',
      motivo: 'Incumplimiento reiterado del horario autorizado',
    });

    expect(respuesta.estado).toBe('revocado');
    expect(tx.notificaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'permiso_revocado' }),
      }),
    );
  });

  it('HU-35: sin motivo no se puede suspender ni revocar (422)', async () => {
    const service = new PermisosService(
      crearPrismaMock(crearTxMock()),
      crearConfigMock(),
    );

    await expect(
      service.cambiarEstado(GESTOR, '8', { estado: 'suspendido' }),
    ).rejects.toThrow(/exige un motivo/);
    await expect(
      service.cambiarEstado(GESTOR, '8', { estado: 'revocado' }),
    ).rejects.toThrow(/exige un motivo/);
  });

  it('HU-35: revocado y vencido son estados finales (422)', async () => {
    const tx = crearTxMock();
    tx.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 8n,
          numero: 'PER-2026-00008',
          estado: 'revocado',
          titular_id: 3n,
          titular_nombre: 'María',
          titular_apellido: 'Gómez',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 9n,
          numero: 'PER-2026-00009',
          estado: 'vencido',
          titular_id: 3n,
          titular_nombre: 'María',
          titular_apellido: 'Gómez',
        },
      ]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    await expect(
      service.cambiarEstado(GESTOR, '8', {
        estado: 'vigente',
        motivo: 'Reactivación',
      }),
    ).rejects.toThrow(/estado final/);
    await expect(
      service.cambiarEstado(GESTOR, '9', {
        estado: 'suspendido',
        motivo: 'Prueba',
      }),
    ).rejects.toThrow(/estado final/);
  });

  it('HU-35: solo se reactiva un permiso suspendido (422)', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 8n,
        numero: 'PER-2026-00008',
        estado: 'vigente',
        titular_id: 3n,
        titular_nombre: 'María',
        titular_apellido: 'Gómez',
      },
    ]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    await expect(
      service.cambiarEstado(GESTOR, '8', { estado: 'vigente' }),
    ).rejects.toThrow(/ya está en estado/);
  });
});

describe('PermisosService — verificación pública (HU-33)', () => {
  function filaPermiso(
    estado: 'vigente' | 'suspendido' | 'revocado',
    diasInicio: number,
    diasFin: number,
  ): {
    id: bigint;
    numero: string;
    estado: string;
    fecha_inicio: Date;
    fecha_fin: Date;
    categoria_autorizada: string;
    titular: string;
  } {
    return {
      id: 8n,
      numero: 'PER-2026-00008',
      estado,
      fecha_inicio: fechaLocal(diasInicio),
      fecha_fin: fechaLocal(diasFin),
      categoria_autorizada: 'Venta de frutas y verduras',
      titular: 'María Gómez',
    };
  }

  function crearServicio(fila: unknown[]): {
    service: PermisosService;
    prisma: Record<string, jest.Mock>;
  } {
    const tx = crearTxMock();
    const prisma = crearPrismaMock(tx) as unknown as Record<string, jest.Mock>;
    prisma.$queryRaw = jest.fn().mockResolvedValue(fila);
    prisma.verificaciones_qr = {
      create: jest.fn().mockResolvedValue({ id: 100n }),
      count: jest.fn(),
      findFirst: jest.fn(),
    };
    const service = new PermisosService(
      prisma as unknown as PrismaService,
      crearConfigMock(),
    );
    return { service, prisma };
  }

  it('HU-33-CA1: un QR válido y vigente responde «válido» sin sesión', async () => {
    const { service, prisma } = crearServicio([filaPermiso('vigente', -1, 29)]);

    const respuesta = await service.verificar(TOKEN_A, '186.84.10.1');

    expect(respuesta.valido).toBe(true);
    expect(respuesta.estado).toBe('vigente');
    expect(respuesta.categoria).toBe('Venta de frutas y verduras');
    expect(respuesta.titular).toBe('María Gómez');
    // La consulta queda registrada en verificaciones_qr con el resultado.
    expect(prisma.verificaciones_qr.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qr_token: TOKEN_A,
          resultado: 'valido',
          ip: '186.84.10.1',
        }),
      }),
    );
  });

  it('HU-33-CA2: suspendido y revocado responden «no vigente» con su estado', async () => {
    const suspendido = crearServicio([filaPermiso('suspendido', -1, 29)]);
    const respuestaSuspendido = await suspendido.service.verificar(
      TOKEN_A,
      null,
    );
    expect(respuestaSuspendido.valido).toBe(false);
    expect(respuestaSuspendido.estado).toBe('suspendido');

    const revocado = crearServicio([filaPermiso('revocado', -1, 29)]);
    const respuestaRevocado = await revocado.service.verificar(TOKEN_A, null);
    expect(respuestaRevocado.valido).toBe(false);
    expect(respuestaRevocado.estado).toBe('revocado');
    expect(revocado.prisma.verificaciones_qr.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resultado: 'no_vigente' }),
      }),
    );
  });

  it('HU-33/D3: vigente con vigencia vencida se reporta como «vencido»', async () => {
    const { service } = crearServicio([filaPermiso('vigente', -30, -1)]);

    const respuesta = await service.verificar(TOKEN_A, null);

    expect(respuesta.valido).toBe(false);
    expect(respuesta.estado).toBe('vencido');
  });

  it('HU-33-CA3: un token inexistente o mal formado responde 404', async () => {
    const { service, prisma } = crearServicio([]);

    await expect(service.verificar(TOKEN_A, null)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.verificar('no-es-un-token-valido', null),
    ).rejects.toThrow('Permiso no encontrado');
    // Ambos casos se registran como «no_encontrado».
    expect(prisma.verificaciones_qr.create).toHaveBeenCalledTimes(2);
  });

  it('HU-33-CA4: la respuesta pública no expone ningún dato sensible', async () => {
    const { service } = crearServicio([filaPermiso('vigente', -1, 29)]);

    const respuesta = await service.verificar(TOKEN_A, null);

    // Datos mínimos de AGENTS §9.5: nada de documento, correo, teléfono,
    // dirección, motivo interno ni hashes de sesión.
    expect(Object.keys(respuesta).sort()).toEqual(
      [
        'categoria',
        'estado',
        'titular',
        'valido',
        'vigenciaFin',
        'vigenciaInicio',
      ].sort(),
    );
    expect(JSON.stringify(respuesta)).not.toMatch(
      /documento|correo|telefono|motivo|password|hash/i,
    );
  });
});

describe('PermisosService — carné del comerciante (HU-32)', () => {
  const FILA_MI_PERMISO = {
    id: 8n,
    numero: 'PER-2026-00008',
    categoria_autorizada: 'Venta de frutas y verduras',
    fecha_inicio: fechaLocal(-1),
    fecha_fin: fechaLocal(29),
    estado: 'vigente',
    qr_token: TOKEN_A,
    emitido_en: new Date('2026-11-23T10:00:00'),
    renovado_desde: null,
    espacios_temporales: { nombre: 'Kiosco Parque La Guadua' },
    permisos: null,
    comerciantes: {
      usuarios: { id: 3n, nombre: 'María', apellido: 'Gómez' },
    },
  };

  it('HU-32-CA1: devuelve el detalle con QR y URL de verificación', async () => {
    const tx = crearTxMock();
    const prisma = crearPrismaMock(tx) as unknown as Record<string, jest.Mock>;
    prisma.permisos.findFirst = jest.fn().mockResolvedValue(FILA_MI_PERMISO);
    const service = new PermisosService(
      prisma as unknown as PrismaService,
      crearConfigMock(),
    );

    const detalle = await service.detalleMio(COMERCIANTE, '8');

    expect(detalle.numero).toBe('PER-2026-00008');
    expect(detalle.qrToken).toBe(TOKEN_A);
    expect(detalle.urlVerificacion).toBe(
      `http://localhost:3001/verificar/${TOKEN_A}`,
    );
    // IDOR: la consulta exige que el titular sea el del JWT.
    expect(prisma.permisos.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8n, titular_id: 3n },
      }),
    );
  });

  it('HU-32: un permiso ajeno responde 404 (IDOR)', async () => {
    const tx = crearTxMock();
    const prisma = crearPrismaMock(tx) as unknown as Record<string, jest.Mock>;
    prisma.permisos.findFirst = jest.fn().mockResolvedValue(null);
    const service = new PermisosService(
      prisma as unknown as PrismaService,
      crearConfigMock(),
    );

    await expect(service.detalleMio(COMERCIANTE, '99')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('HU-32-CA2: el PDF del carné se genera con cabecera de PDF y QR', async () => {
    const tx = crearTxMock();
    const prisma = crearPrismaMock(tx) as unknown as Record<string, jest.Mock>;
    prisma.permisos.findFirst = jest.fn().mockResolvedValue(FILA_MI_PERMISO);
    const service = new PermisosService(
      prisma as unknown as PrismaService,
      crearConfigMock(),
    );

    const { buffer, nombreArchivo } = await service.carneMio(COMERCIANTE, '8');

    expect(nombreArchivo).toBe('carne-PER-2026-00008.pdf');
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('HU-32-CA3: el estado llega al detalle aunque el permiso no esté vigente', async () => {
    const tx = crearTxMock();
    const prisma = crearPrismaMock(tx) as unknown as Record<string, jest.Mock>;
    prisma.permisos.findFirst = jest.fn().mockResolvedValue({
      ...FILA_MI_PERMISO,
      estado: 'suspendido',
    });
    const service = new PermisosService(
      prisma as unknown as PrismaService,
      crearConfigMock(),
    );

    const detalle = await service.detalleMio(COMERCIANTE, '8');
    expect(detalle.estado).toBe('suspendido');
  });
});

describe('PermisosService — renovación (HU-34)', () => {
  function filaRenovable(
    estado: string,
    diasFin: number,
  ): {
    id: bigint;
    numero: string;
    estado: string;
    titular_id: bigint;
    solicitud_id: bigint;
    espacio_id: bigint;
    categoria_autorizada: string;
    fecha_inicio: Date;
    fecha_fin: Date;
  } {
    return {
      id: 8n,
      numero: 'PER-2026-00008',
      estado,
      titular_id: 3n,
      solicitud_id: 12n,
      espacio_id: 4n,
      categoria_autorizada: 'Venta de frutas y verduras',
      fecha_inicio: fechaLocal(-30),
      fecha_fin: fechaLocal(diasFin),
    };
  }

  it('HU-34-CA2: radica la solicitud simplificada con datos precargados', async () => {
    const tx = crearTxMock();
    tx.$queryRaw
      .mockResolvedValueOnce([filaRenovable('vigente', 14)])
      .mockResolvedValueOnce([
        {
          id: 13n,
          numero_radicado: 'SOL-2026-00013',
          fecha_inicio: fechaLocal(15),
          fecha_fin: fechaLocal(44),
        },
      ]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    const respuesta = await service.renovar(COMERCIANTE, '8');

    expect(respuesta.numeroRadicado).toBe('SOL-2026-00013');
    expect(respuesta.mensaje).toContain('precargados');
    // La solicitud nace radicada con historial y sin correo externo.
    expect(tx.solicitud_historial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          solicitud_id: 13n,
          estado_nuevo: 'radicada',
          actor_id: 3n,
        }),
      }),
    );
  });

  it('HU-34-CA4: un permiso ya vencido exige radicar una nueva solicitud (422)', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValueOnce([filaRenovable('vigente', -1)]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    await expect(service.renovar(COMERCIANTE, '8')).rejects.toThrow(
      /ya venció: debe radicar una nueva solicitud/,
    );
  });

  it('HU-34: revocado y suspendido no se pueden renovar (422)', async () => {
    const tx = crearTxMock();
    tx.$queryRaw
      .mockResolvedValueOnce([filaRenovable('revocado', 14)])
      .mockResolvedValueOnce([filaRenovable('suspendido', 14)]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    await expect(service.renovar(COMERCIANTE, '8')).rejects.toThrow(/revocado/);
    await expect(service.renovar(COMERCIANTE, '8')).rejects.toThrow(
      /suspendido/,
    );
  });

  it('HU-34: un permiso ajeno responde 404 (IDOR)', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValue([]);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());

    await expect(service.renovar(COMERCIANTE, '99')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('HU-34: una renovación en curso para el mismo espacio responde 409', async () => {
    const tx = crearTxMock();
    tx.$queryRaw.mockResolvedValueOnce([filaRenovable('vigente', 14)]);
    tx.solicitudes.count.mockResolvedValueOnce(1);
    const service = new PermisosService(crearPrismaMock(tx), crearConfigMock());
    await expect(service.renovar(COMERCIANTE, '8')).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('PermisosService — listado y trazabilidad (HU-37)', () => {
  const FILA_GESTOR = {
    id: 8n,
    numero: 'PER-2026-00008',
    solicitud_id: 12n,
    titular_id: 3n,
    espacio_id: 4n,
    categoria_autorizada: 'Venta de frutas y verduras',
    fecha_inicio: fechaLocal(-1),
    fecha_fin: fechaLocal(29),
    estado: 'vigente',
    qr_token: TOKEN_A,
    emitido_por: 2n,
    emitido_en: new Date('2026-11-23T10:00:00'),
    renovado_desde: null,
    solicitudes: { numero_radicado: 'SOL-2026-00012' },
    comerciantes: {
      usuarios: { id: 3n, nombre: 'María', apellido: 'Gómez' },
    },
    espacios_temporales: { id: 4n, nombre: 'Kiosco Parque La Guadua' },
    gestores: {
      usuarios_gestores_usuario_idTousuarios: {
        id: 2n,
        nombre: 'Carlos',
        apellido: 'Ramírez',
      },
    },
    permisos: null,
    other_permisos: [],
    cobros: { id: 1n, valor: 50000, estado: 'pendiente', pagado_en: null },
  };

  it('HU-37-CA2: filtra por estado, rango de fechas y busca por texto', async () => {
    const tx = crearTxMock();
    const prisma = crearPrismaMock(tx) as unknown as Record<string, jest.Mock>;
    prisma.permisos.findMany = jest.fn().mockResolvedValue([FILA_GESTOR]);
    prisma.permisos.count = jest.fn().mockResolvedValue(1);
    const service = new PermisosService(
      prisma as unknown as PrismaService,
      crearConfigMock(),
    );

    const respuesta = await service.listar({
      q: 'Gómez',
      estado: 'vigente',
      desde: '2026-11-01',
      hasta: '2026-11-30',
      pagina: 1,
      limite: 20,
    });

    const where = (prisma.permisos.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.estado).toBe('vigente');
    expect(where.fecha_fin).toEqual({
      gte: new Date('2026-11-01T00:00:00.000Z'),
    });
    expect(where.fecha_inicio).toEqual({
      lte: new Date('2026-11-30T00:00:00.000Z'),
    });
    expect(where.OR).toHaveLength(3);
    expect(respuesta.datos[0].titularNombre).toBe('María Gómez');
    expect(respuesta.paginacion).toEqual({
      pagina: 1,
      limite: 20,
      total: 1,
      totalPaginas: 1,
    });
  });

  it('HU-37-CA3: la trazabilidad une eventos del trigger y verificaciones QR', async () => {
    const tx = crearTxMock();
    const prisma = crearPrismaMock(tx) as unknown as Record<string, jest.Mock>;
    prisma.permisos.findUnique = jest.fn().mockResolvedValue(FILA_GESTOR);
    prisma.permiso_eventos.findMany = jest.fn().mockResolvedValue([
      {
        id: 31n,
        evento: 'emitido',
        motivo: null,
        creado_en: new Date('2026-11-23T10:00:00'),
        usuarios: { id: 2n, nombre: 'Carlos', apellido: 'Ramírez' },
      },
      {
        id: 32n,
        evento: 'suspendido',
        motivo: 'Inspección',
        creado_en: new Date('2026-11-24T10:00:00'),
        usuarios: null,
      },
    ]);
    prisma.verificaciones_qr.count = jest.fn().mockResolvedValue(2);
    prisma.verificaciones_qr.findFirst = jest.fn().mockResolvedValue({
      creado_en: new Date('2026-11-25T15:30:00'),
    });
    const service = new PermisosService(
      prisma as unknown as PrismaService,
      crearConfigMock(),
    );

    const trazabilidad = await service.trazabilidad('8');

    expect(trazabilidad.permiso.numero).toBe('PER-2026-00008');
    expect(trazabilidad.eventos).toHaveLength(2);
    expect(trazabilidad.eventos[0].actorNombre).toBe('Carlos Ramírez');
    expect(trazabilidad.verificaciones.total).toBe(2);
    expect(trazabilidad.verificaciones.ultima).toEqual(
      new Date('2026-11-25T15:30:00'),
    );
  });
});

describe('AvisosVencimientoService (HU-34, tarea 1230)', () => {
  it('crea los avisos del día y devuelve la cantidad generada', async () => {
    const tx = crearTxMock();
    const prisma = crearPrismaMock(tx) as unknown as Record<string, jest.Mock>;
    prisma.$queryRaw = jest.fn().mockResolvedValue([{ id: 21n }, { id: 22n }]);
    const service = new AvisosVencimientoService(
      prisma as unknown as PrismaService,
    );

    const creadas = await service.generarAvisos(new Date('2026-11-23'));

    expect(creadas).toBe(2);
    const sql = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain('aviso_vencimiento');
    expect(sql).toContain('NOT EXISTS');
  });

  it('no reporta avisos cuando ya están creados (idempotente por día)', async () => {
    const tx = crearTxMock();
    const prisma = crearPrismaMock(tx) as unknown as Record<string, jest.Mock>;
    prisma.$queryRaw = jest.fn().mockResolvedValue([]);
    const service = new AvisosVencimientoService(
      prisma as unknown as PrismaService,
    );

    const creadas = await service.generarAvisos(new Date('2026-11-23'));

    expect(creadas).toBe(0);
  });
});
