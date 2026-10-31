export const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const TELEFONO_RE = /^[+0-9][0-9\s()-]{6,29}$/;
export const DOCUMENTO_RE = /^[A-Za-z0-9-]{5,30}$/;
export const CODIGO_6_RE = /^\d{6}$/;
export const NIT_RE = /^\d{8,10}(-\d)?$/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function validarNombre(valor: string): string | null {
  const texto = valor.trim();
  if (texto.length < 2) return "Debe tener al menos 2 caracteres.";
  if (texto.length > 150) return "No puede superar los 150 caracteres.";
  return null;
}

export function validarApellido(valor: string): string | null {
  if (valor.trim() === "") return null;
  return validarNombre(valor);
}

export function validarCorreo(valor: string): string | null {
  const texto = valor.trim();
  if (texto === "") return "El correo electrónico es obligatorio.";
  if (texto.length > 150) return "No puede superar los 150 caracteres.";
  if (!CORREO_RE.test(texto)) return "Ingresa un correo electrónico válido.";
  return null;
}

export function validarTelefono(valor: string): string | null {
  const texto = valor.trim();
  if (texto === "") return "El teléfono es obligatorio.";
  if (!TELEFONO_RE.test(texto)) return "Ingresa un número de teléfono válido.";
  return null;
}

export function validarDocumento(valor: string): string | null {
  const texto = valor.trim();
  if (texto === "") return "El número de documento es obligatorio.";
  if (!DOCUMENTO_RE.test(texto))
    return "De 5 a 30 caracteres: letras, números o guion.";
  return null;
}

export function validarPassword(valor: string): string | null {
  if (valor.length < PASSWORD_MIN)
    return `Debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (valor.length > PASSWORD_MAX)
    return `No puede superar los ${PASSWORD_MAX} caracteres.`;
  if (!/\d/.test(valor)) return "Debe incluir al menos un número.";
  return null;
}

export function validarCoincidencia(
  password: string,
  confirmacion: string,
): string | null {
  if (confirmacion !== password) return "Las contraseñas no coinciden.";
  return null;
}

export function validarActividadComercial(valor: string): string | null {
  const texto = valor.trim();
  if (texto.length < 3) return "Debe tener al menos 3 caracteres.";
  if (texto.length > 200) return "No puede superar los 200 caracteres.";
  return null;
}

export function validarCodigo6(valor: string): string | null {
  if (!CODIGO_6_RE.test(valor)) return "Ingresa el código de 6 dígitos.";
  return null;
}

export type FortalezaPassword = {
  nivel: 0 | 1 | 2 | 3 | 4;
  etiqueta: string;
  claseBarra: string;
};

export function evaluarFortalezaPassword(
  valor: string,
): FortalezaPassword {
  let puntos = 0;
  if (valor.length >= 8) puntos += 1;
  if (valor.length >= 12) puntos += 1;
  if (/\d/.test(valor) && /[a-zA-Z]/.test(valor)) puntos += 1;
  if (/[^A-Za-z0-9]/.test(valor)) puntos += 1;

  const nivel = Math.min(puntos, 4) as 0 | 1 | 2 | 3 | 4;
  const tabla: Record<number, { etiqueta: string; claseBarra: string }> = {
    0: { etiqueta: "Muy débil", claseBarra: "bg-rose-500" },
    1: { etiqueta: "Débil", claseBarra: "bg-rose-500" },
    2: { etiqueta: "Aceptable", claseBarra: "bg-amber-500" },
    3: { etiqueta: "Fuerte", claseBarra: "bg-emerald-500" },
    4: { etiqueta: "Muy fuerte", claseBarra: "bg-emerald-600" },
  };

  return { nivel, ...tabla[nivel] };
}

export function primerErrorDe(
  campos: Record<string, string | null>,
): string | null {
  for (const error of Object.values(campos)) {
    if (error) return error;
  }
  return null;
}
