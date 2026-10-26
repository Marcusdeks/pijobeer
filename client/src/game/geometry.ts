/**
 * Geometría básica: rectángulos, colisiones y puntería.
 */

/** Un punto del área de juego (p. ej. al que apuntan los jefes). */
export interface Point {
  x: number;
  y: number;
}

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

/**
 * Ángulo para disparar desde `from` hacia `to`, en grados desde la vertical
 * hacia ABAJO (0 = recto hacia abajo, positivo = hacia la derecha), limitado
 * a ±maxDegrees. Si el objetivo está por encima, se apunta como si estuviera
 * a la misma altura: los enemigos disparan siempre hacia abajo, y el tope
 * evita disparos casi horizontales, imposibles de esquivar.
 */
export function aimDegrees(from: Point, to: Point, maxDegrees: number): number {
  const degrees = (Math.atan2(to.x - from.x, Math.max(1, to.y - from.y)) * 180) / Math.PI;
  return clamp(degrees, -maxDegrees, maxDegrees);
}

/** Velocidad (píxeles por paso en cada eje) de algo que avanza `speed` en la dirección de aimDegrees. */
export function velocityAt(degrees: number, speed: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: Math.sin(radians) * speed, y: Math.cos(radians) * speed };
}
