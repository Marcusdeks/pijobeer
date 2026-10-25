/**
 * HOJA DE SPRITES DEL JUGADOR: qué trozo de la imagen se dibuja en cada momento.
 *
 * La hoja (assets/sprites/player.png) es una rejilla:
 *   - 8 filas    -> una por dirección (arriba, arriba-derecha, ..., arriba-izquierda)
 *   - 4 columnas -> ciclo de andar: neutro, paso 1, neutro, paso 2
 *   - cada frame mide 64x80 px
 *
 * Todos esos números vienen de player.json, que es la ÚNICA fuente de verdad:
 * lo usan tanto este archivo como el script que genera la hoja
 * (scripts/build-player-spritesheet.mjs). Si cambia el tamaño de frame o el
 * orden de las filas, se cambia ahí y ambos se enteran.
 *
 * El "pivote" es el punto de cada frame que se apoya en el suelo (entre los
 * pies). El juego coloca ese punto en la base del jugador, así el personaje
 * "pisa" siempre en el mismo sitio aunque cada pose tenga una forma distinta.
 *
 * Este módulo solo contiene DATOS y cálculos; la imagen en sí la carga
 * GameCanvas. Así la lógica del jugador no depende de ningún archivo de imagen
 * y se puede testear en Node sin navegador.
 */
import meta from '../../assets/sprites/player.json';
import { SIMULATION_STEPS_PER_SECOND } from '../config';
import { DIRECTIONS, type Direction } from '../direction';

export const PLAYER_FRAME = {
  width: meta.frame_width,
  height: meta.frame_height,
} as const;

/** Punto de apoyo de los pies dentro de cada frame. */
export const PLAYER_PIVOT = {
  x: meta.pivot_pies.x,
  y: meta.pivot_pies.y,
} as const;

/** Frames del ciclo de andar (columnas de la hoja). */
export const WALK_CYCLE_LENGTH = meta.columns;

/** Columna que se usa cuando el personaje está quieto (el primer "neutro"). */
export const IDLE_FRAME = meta.frame_order.indexOf('neutro');

/**
 * Pasos de simulación que dura cada frame de la animación.
 * El JSON lo da en milisegundos; el motor cuenta en pasos de 1/60 s
 * (160 ms ≈ 9,6 pasos). Se usa número decimal a propósito: redondear a
 * 10 haría la animación un 4 % más lenta de lo que pide el JSON.
 */
export const STEPS_PER_ANIMATION_FRAME =
  (meta.frame_duration_ms / 1000) * SIMULATION_STEPS_PER_SECOND;

/**
 * Comprueba al cargar que el JSON está completo y es coherente.
 * Es un archivo que se edita a mano: mejor un error claro al arrancar que
 * un personaje que se dibuja con el frame equivocado sin que nadie sepa por qué.
 */
function validateMeta(): void {
  const rows: Record<string, number> = meta.filas;
  for (const direction of DIRECTIONS) {
    const row = rows[direction];
    if (row === undefined || row < 0 || row >= meta.rows) {
      throw new Error(`player.json: la fila de "${direction}" falta o está fuera de rango`);
    }
  }
  if (meta.frame_order.length !== meta.columns) {
    throw new Error('player.json: frame_order debe tener tantos elementos como columnas');
  }
  if (IDLE_FRAME < 0) {
    throw new Error('player.json: frame_order necesita al menos un frame "neutro"');
  }
}

validateMeta();

/** Rectángulo de la hoja (en píxeles) que corresponde a una dirección y un frame. */
export interface SpriteFrame {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

export function playerFrame(direction: Direction, frameIndex: number): SpriteFrame {
  const row = meta.filas[direction];
  // El módulo protege de índices fuera de rango (p. ej. si el ciclo cambiara de longitud)
  const column = ((frameIndex % WALK_CYCLE_LENGTH) + WALK_CYCLE_LENGTH) % WALK_CYCLE_LENGTH;

  return {
    sx: column * PLAYER_FRAME.width,
    sy: row * PLAYER_FRAME.height,
    width: PLAYER_FRAME.width,
    height: PLAYER_FRAME.height,
  };
}
