import {
  calcularCambiosModulo,
  normalizarAccionAuditoria,
  parsearRegistroAuditoria,
} from './historial';

describe('historial de módulos', () => {
  it('normaliza registros JSON de auditoría', () => {
    expect(parsearRegistroAuditoria('{"estado":"activo"}')).toEqual({
      estado: 'activo',
    });
    expect(parsearRegistroAuditoria(null)).toBeNull();
    expect(parsearRegistroAuditoria('no-json')).toBeNull();
  });

  it('normaliza acciones de auditoría', () => {
    expect(normalizarAccionAuditoria('INSERT')).toBe('insert');
    expect(normalizarAccionAuditoria('update')).toBe('update');
    expect(normalizarAccionAuditoria('desconocida')).toBe('update');
  });

  it('calcula los cambios relevantes entre dos snapshots', () => {
    const anterior = {
      categoria: 'informal',
      titular_id: 4,
      titular_nombre: null,
      actividad: 'Empanadas',
      foto_url: null,
      estado: 'activo',
      ubicacion: { type: 'Point', coordinates: [-76.1, 4.1] },
    };
    const nuevo = {
      categoria: 'formal',
      titular_id: 4,
      titular_nombre: null,
      actividad: 'Artesanías',
      foto_url: '/uploads/modulos/foto.jpg',
      estado: 'baja',
      ubicacion: { type: 'Point', coordinates: [-76.1, 4.1] },
    };

    expect(calcularCambiosModulo(anterior, nuevo)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campo: 'categoria',
          anterior: 'informal',
          nuevo: 'formal',
        }),
        expect.objectContaining({
          campo: 'actividad',
          anterior: 'Empanadas',
          nuevo: 'Artesanías',
        }),
        expect.objectContaining({
          campo: 'foto_url',
          anterior: null,
          nuevo: '/uploads/modulos/foto.jpg',
        }),
        expect.objectContaining({
          campo: 'estado',
          anterior: 'activo',
          nuevo: 'baja',
        }),
      ]),
    );
  });

  it('no devuelve cambios cuando no hay snapshots', () => {
    expect(calcularCambiosModulo(null, { estado: 'activo' })).toEqual([]);
  });
});
