/**
 * NIVELES DEL JUEGO: el diseño completo de cada nivel, en un solo sitio.
 *
 * El cliente lo usa para jugar (fondo, enemigos, jefe, victoria) y el servidor
 * para rechazar niveles que no existen (nadie debe poder mandar "nivel 99").
 *
 * La DIFICULTAD sube de un nivel a otro con tres palancas:
 *   - spawnInterval: cada cuántos pasos sale una botella (menos = más botellas).
 *   - enemySpeed:    multiplicador de la velocidad de caída de todas las botellas.
 *   - enemyMix:      proporción de cada tipo de botella (ver ENEMY_TYPES en el cliente).
 *
 * Para AÑADIR UN NIVEL: añade un objeto al final. MAX_LEVEL se calcula solo.
 */

/** Jefes finales disponibles (su comportamiento está en client/src/game/config.ts). */
export type BossId = 'blonde' | 'dark';

/** Tipos de botella (sus estadísticas están en client/src/game/config.ts). */
export type EnemyTypeId = 'normal' | 'fast' | 'heavy';

export interface LevelDefinition {
  readonly id: number;
  /** Callejón del fondo (art/alleys/alley-N.png). Cada nivel tiene el suyo. */
  readonly alley: 1 | 2 | 3;
  /**
   * Botellas que hay que eliminar. Sin jefe, al conseguirlo se gana el nivel.
   * Con jefe, al conseguirlo dejan de salir botellas y aparece el jefe.
   */
  readonly killsToComplete: number;
  readonly boss: BossId | null;
  /** Pasos entre la aparición de una botella y la siguiente (60 pasos = 1 s). */
  readonly spawnInterval: number;
  /** Multiplicador de la velocidad de caída de las botellas. */
  readonly enemySpeed: number;
  /** Peso de cada tipo de botella al aparecer (no hace falta que sumen 1). */
  readonly enemyMix: Readonly<Partial<Record<EnemyTypeId, number>>>;
}

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 1,
    alley: 1,
    killsToComplete: 36,
    boss: null,
    spawnInterval: 90,
    enemySpeed: 1,
    enemyMix: { normal: 1 },
  },
  {
    id: 2,
    alley: 2,
    killsToComplete: 50,
    boss: 'blonde',
    spawnInterval: 70,
    enemySpeed: 1.15,
    enemyMix: { normal: 5, fast: 3, heavy: 2 },
  },
  {
    id: 3,
    alley: 3,
    killsToComplete: 60,
    boss: 'dark',
    spawnInterval: 55,
    enemySpeed: 1.3,
    enemyMix: { normal: 3, fast: 4, heavy: 3 },
  },
];

/** Nivel más alto que existe. Se deriva de LEVELS para no tener que mantenerlo a mano. */
export const MAX_LEVEL = LEVELS.length;

/** Nivel con el que empieza cualquier jugador. */
export const FIRST_LEVEL = 1;

/**
 * Devuelve la definición de un nivel.
 * @throws {RangeError} si el nivel no existe (es un error de programación, no del usuario).
 */
export function getLevel(id: number): LevelDefinition {
  const level = LEVELS.find((candidate) => candidate.id === id);
  if (!level) throw new RangeError(`El nivel ${id} no existe (hay ${MAX_LEVEL}).`);
  return level;
}

/** `true` si el número corresponde a un nivel real. */
export function isValidLevel(id: number): boolean {
  return Number.isInteger(id) && id >= FIRST_LEVEL && id <= MAX_LEVEL;
}

/** El nivel que va después de `id`, o null si `id` es el último. */
export function nextLevelId(id: number): number | null {
  return isValidLevel(id + 1) ? id + 1 : null;
}
