/**
 * Extracción del token QR a partir del contenido decodificado (HU-33).
 *
 * El QR del carné codifica la URL pública `${FRONTEND_URL}/verificar/<token>`
 * (decisión de contenido del QR): al escanearlo con cualquier app se abre
 * directo el resultado. El escáner de la plataforma también acepta el
 * token crudo escrito a mano.
 */
export function extraerTokenQr(texto: string): string | null {
  const limpio = texto.trim();
  if (limpio === "") return null;

  const desdeSegmentos = (segmentos: string[]): string | null => {
    const posicion = segmentos.lastIndexOf("verificar");
    const candidatos =
      posicion >= 0 ? segmentos.slice(posicion + 1) : segmentos;
    const ultimo = candidatos[candidatos.length - 1];
    return ultimo ? decodeURIComponent(ultimo) : null;
  };

  // URL completa: se toma el segmento posterior a «verificar».
  if (/^https?:\/\//i.test(limpio)) {
    try {
      return desdeSegmentos(new URL(limpio).pathname.split("/").filter(Boolean));
    } catch {
      return null;
    }
  }

  // Ruta relativa tipo /verificar/<token>.
  if (limpio.startsWith("/")) {
    return desdeSegmentos(limpio.split("/").filter(Boolean));
  }

  // Token crudo (48 caracteres hex generados por la BD).
  return limpio;
}

/** Valida el formato del token que genera la BD: 48 caracteres hex. */
export function esTokenValido(token: string): boolean {
  return /^[0-9a-f]{48}$/.test(token.trim().toLowerCase());
}

/** Prepara el token para la URL: normaliza a minúsculas. */
export function normalizarToken(token: string): string {
  return token.trim().toLowerCase();
}
