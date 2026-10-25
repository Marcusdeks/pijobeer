/**
 * DIFICULTADES que el jugador elige en el menú.
 *
 * No cambian el diseño de los niveles (eso está en levels.ts): son
 * multiplicadores que se aplican ENCIMA de cada nivel. 'normal' deja el
 * juego tal y como está diseñado (todo a 1).
 *
 *   enemySpeed    velocidad de caída de las botellas
 *   spawnRate     cuántas botellas salen (1,2 = un 20 % más a menudo)
 *   bossHealth    vida de los jefes
 *   damageTaken   vida que pierde el jugador con cada golpe
 *   points        puntos de la partida. Premia jugar en difícil y evita que
 *                 en el ranking compitan igual una partida fácil y una difícil.
 *
 * Vive en el paquete compartido junto al resto de reglas de puntuación
 * (game-rules.ts), por si el servidor tiene que conocerlas algún día.
 */
export const DIFFICULTIES = {
  easy: { enemySpeed: 0.85, spawnRate: 0.8, bossHealth: 0.5, damageTaken: 0.5, points: 0.5 },
  normal: { enemySpeed: 1, spawnRate: 1, bossHealth: 1, damageTaken: 1, points: 1 },
  hard: { enemySpeed: 1.15, spawnRate: 1.2, bossHealth: 1.3, damageTaken: 1.5, points: 2 },
} as const;

export type DifficultyId = keyof typeof DIFFICULTIES;
export type DifficultySettings = (typeof DIFFICULTIES)[DifficultyId];

/** En el orden en que se muestran en el menú. */
export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as DifficultyId[];

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

/** Para validar valores que vienen de fuera (localStorage, peticiones...). */
export function isDifficulty(value: unknown): value is DifficultyId {
  return typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);
}
