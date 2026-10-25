/**
 * Geometría básica: rectángulos y colisiones.
 */

/** Cualquier cosa con posición y tamaño (jugador, enemigo, bala). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * ¿Se solapan dos rectángulos? (colisión "AABB", caja contra caja).
 *
 * Dos rectángulos NO se tocan si uno está entero a la izquierda, a la
 * derecha, encima o debajo del otro. Si no se da ninguno de esos cuatro
 * casos, es que se solapan.
 */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Limita un valor al rango [min, max]. Sirve para que nada salga del área de juego. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
