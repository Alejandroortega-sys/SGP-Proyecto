/**
 * Lee un entero positivo de la configuración de entorno.
 *
 * Devuelve el valor por defecto si la variable falta, está vacía o no es un
 * entero mayor que cero. Sirve para parámetros como vigencias, contadores y
 * límites, donde un valor corrupto no debe tumbar la aplicación al arrancar.
 */
export function enteroPositivo(
  valor: string | undefined,
  porDefecto: number,
): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : porDefecto;
}
