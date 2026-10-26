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
 * Para superarlo (o para que salga el jefe) hay que eliminar killsToComplete
 * botellas Y recorrer distanceToComplete píxeles de callejón.
 *
 * Para AÑADIR UN NIVEL: añade un objeto al final. MAX_LEVEL se calcula solo.
 */

/**
 * Jefes finales disponibles (su comportamiento está en client/src/game/config.ts).
 * Los barriles disparan espuma; el pijo lanza botellas teledirigidas.
 */
export type BossId = 'wood' | 'iron' | 'pijo';

/**
 * Tipos de enemigo que caen durante el nivel (sus estadísticas están en
 * client/src/game/config.ts): tres botellas y el barril pequeño del nivel 4.
 */
export type EnemyTypeId = 'normal' | 'fast' | 'heavy' | 'barrel';

export interface LevelDefinition {
  readonly id: number;
  /** Callejón del fondo (art/alleys/alley-N.png). Cada nivel tiene el suyo. */
  readonly alley: 1 | 2 | 3 | 4;
  /**
   * Botellas que hay que eliminar. Sin jefe, al conseguirlo se gana el nivel.
   * Con jefe, al conseguirlo dejan de salir botellas y aparece el jefe.
   */
  readonly killsToComplete: number;
  /**
   * Píxeles de callejón que hay que recorrer ADEMÁS de las botellas (0 = no
   * hace falta). El jugador no lo ve: el callejón solo avanza mientras él anda
   * hacia delante (ver CAMERA en client/src/game/config.ts), así que quedarse
   * quieto esquivando no basta para llegar al jefe.
   */
  readonly distanceToComplete: number;
  /**
   * Jefes finales que aparecen A LA VEZ al cumplir el objetivo (vacío = nivel
   * sin jefe). Se gana al derrotarlos a todos.
   */
  readonly bosses: readonly BossId[];
  /** Si el jugador puede protegerse con la chupa (tecla B) en este nivel. */
  readonly jacket: boolean;
  /** Pasos entre la aparición de una botella y la siguiente (60 pasos = 1 s). */
  readonly spawnInterval: number;
  /** Multiplicador de la velocidad de caída de las botellas. */
  readonly enemySpeed: number;
  /** Peso de cada tipo de enemigo al aparecer (no hace falta que sumen 1). */
  readonly enemyMix: Readonly<Partial<Record<EnemyTypeId, number>>>;
}

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 1,
    alley: 1,
    killsToComplete: 36,
    distanceToComplete: 0,
    bosses: [],
    jacket: false,
    spawnInterval: 90,
    enemySpeed: 1,
    enemyMix: { normal: 1 },
  },
  {
    id: 2,
    alley: 2,
    killsToComplete: 50,
    // 30 s avanzando por el callejón (60 px/s, ver CAMERA en el cliente)
    distanceToComplete: 1800,
    bosses: ['wood'],
    jacket: false,
    spawnInterval: 70,
    enemySpeed: 1.15,
    enemyMix: { normal: 5, fast: 3, heavy: 2 },
  },
  {
    id: 3,
    alley: 3,
    killsToComplete: 60,
    // 40 s avanzando por el callejón
    distanceToComplete: 2400,
    bosses: ['iron'],
    // Desde aquí, la chupa (el aviso de cómo usarla sale antes del jefe, la primera vez)
    jacket: true,
    spawnInterval: 55,
    enemySpeed: 1.3,
    enemyMix: { normal: 3, fast: 4, heavy: 3 },
  },
  {
    id: 4,
    alley: 4,
    killsToComplete: 70,
    // 50 s avanzando por el callejón
    distanceToComplete: 3000,
    // Dos pijos a la vez, que lanzan botellas teledirigidas
    bosses: ['pijo', 'pijo'],
    jacket: true,
    spawnInterval: 48,
    enemySpeed: 1.4,
    // 1 de cada 25 es un barril pequeño (4 %): unos 3 por nivel
    enemyMix: { normal: 7, fast: 9, heavy: 8, barrel: 1 },
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
