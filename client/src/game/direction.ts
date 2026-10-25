/**
 * Las 8 direcciones en las que puede mirar el personaje.
 *
 * Se nombran según la PANTALLA (arriba = hacia la parte de arriba del canvas),
 * con las mismas claves que las filas de assets/sprites/player.json.
 */
export const DIRECTIONS = [
  'arriba',
  'arriba_derecha',
  'derecha',
  'abajo_derecha',
  'abajo',
  'abajo_izquierda',
  'izquierda',
  'arriba_izquierda',
] as const;

export type Direction = (typeof DIRECTIONS)[number];

/**
 * Convierte un movimiento en dirección.
 *
 * @param dx - -1 izquierda, 0 nada, 1 derecha
 * @param dy - -1 arriba, 0 nada, 1 abajo (en el canvas la Y crece hacia ABAJO)
 * @returns la dirección, o null si no hay movimiento (el personaje conserva la que tenía)
 *
 * Funciona como una tabla de 3x3 indexada por (dx, dy): sin cálculos de
 * ángulos, porque con teclado las únicas combinaciones posibles son estas 8.
 */
export function directionFromInput(dx: number, dy: number): Direction | null {
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);

  if (sx === 0 && sy === 0) return null;

  const table: Record<string, Direction> = {
    '0,-1': 'arriba',
    '1,-1': 'arriba_derecha',
    '1,0': 'derecha',
    '1,1': 'abajo_derecha',
    '0,1': 'abajo',
    '-1,1': 'abajo_izquierda',
    '-1,0': 'izquierda',
    '-1,-1': 'arriba_izquierda',
  };

  return table[`${sx},${sy}`] ?? null;
}
