import { describe, expect, it } from 'vitest';
import {
  esGestorAdministrador,
  nombreRol,
  rutaDetalleSolicitud,
  rutaInicio,
} from '@/lib/rutas';

describe('rutas por rol', () => {
  it('redirige cada rol a su inicio', () => {
    expect(rutaInicio({ rol: 'comerciante' })).toBe('/comerciante/inicio');
    expect(rutaInicio({ rol: 'organizador' })).toBe('/organizador/inicio');
    expect(rutaInicio({ rol: 'gestor' })).toBe('/gestor/panel');
  });

  it('identifica al gestor administrador', () => {
    expect(
      esGestorAdministrador({ rol: 'gestor', perfil: 'administrador' }),
    ).toBe(true);
    expect(esGestorAdministrador({ rol: 'gestor', perfil: 'revisor' })).toBe(
      false,
    );
    expect(esGestorAdministrador({ rol: 'comerciante', perfil: null })).toBe(
      false,
    );
    expect(esGestorAdministrador(null)).toBe(false);
  });

  it('traduce los roles', () => {
    expect(nombreRol('comerciante')).toBe('Comerciante');
    expect(nombreRol('organizador')).toBe('Organizador');
    expect(nombreRol('gestor')).toBe('Gestor municipal');
  });

  it('enlaza la notificación al detalle solo para el comerciante', () => {
    expect(rutaDetalleSolicitud('comerciante', '12')).toBe(
      '/comerciante/solicitudes/12',
    );
    expect(rutaDetalleSolicitud('gestor', '12')).toBeNull();
    expect(rutaDetalleSolicitud('organizador', '12')).toBeNull();
  });
});
