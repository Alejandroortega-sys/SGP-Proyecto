import type { tipo_zona } from '../generated/prisma/client';

/** Zona mínima necesaria para calcular las advertencias de un punto. */
export interface ZonaAdvertencia {
  id: string;
  nombre: string;
  tipo: tipo_zona;
}

/** Tipo de advertencia que se muestra antes de confirmar el censo. */
export type TipoAdvertenciaModulo =
  | 'zona_restringida'
  | 'alta_congestion'
  | 'fuera_de_zona';

/** Advertencia calculada a partir de la zona contenedora del punto. */
export interface AdvertenciaModulo {
  tipo: TipoAdvertenciaModulo;
  mensaje: string;
  requiereConfirmacion: boolean;
}

/**
 * Calcula las advertencias de un punto según la zona activa que lo contiene.
 *
 * - Zona restringida: exige confirmación explícita antes de guardar.
 * - Alta congestión: advierte, pero permite continuar.
 * - Sin zona activa: advierte, pero permite continuar.
 * - Zona permitida: no genera advertencias.
 *
 * La función es pura para poder probarla sin base de datos ni HTTP.
 */
export function calcularAdvertenciasZona(
  zona: ZonaAdvertencia | null,
): AdvertenciaModulo[] {
  if (zona === null) {
    return [
      {
        tipo: 'fuera_de_zona',
        mensaje:
          'El punto no está dentro de una zona activa del municipio. ' +
          'Podrás guardarlo, pero no tendrá restricciones de zona asociadas.',
        requiereConfirmacion: false,
      },
    ];
  }

  if (zona.tipo === 'restringida') {
    return [
      {
        tipo: 'zona_restringida',
        mensaje:
          `El punto está en la zona restringida «${zona.nombre}». ` +
          'El censo se guardará solo si confirmas que conoces la restricción.',
        requiereConfirmacion: true,
      },
    ];
  }

  if (zona.tipo === 'alta_congestion') {
    return [
      {
        tipo: 'alta_congestion',
        mensaje:
          `El punto está en la zona de alta congestión «${zona.nombre}». ` +
          'Revisa el aforo y las restricciones antes de continuar.',
        requiereConfirmacion: false,
      },
    ];
  }

  return [];
}

/** Indica si alguna advertencia exige confirmación explícita. */
export function exigeConfirmacion(
  advertencias: readonly AdvertenciaModulo[],
): boolean {
  return advertencias.some((advertencia) => advertencia.requiereConfirmacion);
}
