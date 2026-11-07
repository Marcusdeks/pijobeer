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
 * Los barriles disparan espuma; el pijo lanza botellas hacia el jugador y su
 * primo (nivel 5), barriles. En el despacho del nivel 6, el alcalde y sus dos
 * chicas (la rubia y la pelirroja) lanzan botellas.
 */
export type BossId = 'wood' | 'iron' | 'pijo' | 'primo' | 'mayor' | 'blonde' | 'redhead';

/**
 * Tipos de enemigo (sus estadísticas están en client/src/game/config.ts): los
 * que caen durante el nivel (tres botellas, el barril pequeño del nivel 4 y
 * los dos del nivel 5, que disparan en abanico: el de madera y el de hierro)
 * y los seguratas del nivel 6, que no caen: ya están en su sitio.
 */
export type EnemyTypeId =
  'normal' | 'fast' | 'heavy' | 'barrel' | 'woodBarrel' | 'ironBarrel' | 'guard';

/** Callejones con arte propio (art/alleys/alley-N.png). */
export type AlleyId = 1 | 2 | 3 | 4 | 5;

export interface LevelDefinition {
  readonly id: number;
  /**
   * Callejón del fondo. Cada nivel de calle tiene el suyo; null en los que
   * pasan dentro de un edificio (ver interior).
   */
  readonly alley: AlleyId | null;
  /**
   * Niveles dentro del ayuntamiento (el 6), en salas fijas que no avanzan.
   * Se empieza en la planta baja con `guards` seguratas ya colocados: hay que
   * eliminarlos a todos (son las kills del nivel) para subir al despacho del
   * alcalde, donde esperan los jefes. null = nivel de calle.
   */
  readonly interior: { readonly guards: number } | null;
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
  /**
   * Enemigos que siguen saliendo DURANTE el combate con los jefes (null = ninguno):
   * de qué tipo y cada cuántos pasos.
   */
  readonly bossFightEnemy: { readonly type: EnemyTypeId; readonly spawnInterval: number } | null;
  /** Desde cuándo puede protegerse el jugador con la chupa (tecla B) en este nivel. */
  readonly jacket: JacketAvailability;
  /**
   * Multiplicador de los disparos del jugador en este nivel (1 = el ritmo de
   * siempre; 1,3 = un 30 % más). Desde el nivel 5 el protagonista dispara
   * más: se le está poniendo el brazo fuerte de tanta cerveza de verdad.
   * Se multiplica con el de la dificultad (fireRate en difficulty.ts).
   */
  readonly playerFireRate: number;
  /**
   * Pasos entre la aparición de una botella y la siguiente (60 pasos = 1 s).
   * null = no cae nada (dentro del ayuntamiento, los enemigos ya están en la sala).
   */
  readonly spawnInterval: number | null;
  /** Multiplicador de la velocidad de caída de las botellas (y de lo que lanzan los jefes). */
  readonly enemySpeed: number;
  /** Peso de cada tipo de enemigo al aparecer (no hace falta que sumen 1; vacío si no cae nada). */
  readonly enemyMix: Readonly<Partial<Record<EnemyTypeId, number>>>;
}

/**
 * Cuándo se puede usar la chupa en un nivel:
 *   never   nunca
 *   bosses  solo contra los jefes (en el nivel 3, donde se aprende a usarla)
 *   always  durante todo el nivel
 */
export type JacketAvailability = 'never' | 'bosses' | 'always';

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 1,
    alley: 1,
    interior: null,
    killsToComplete: 36,
    distanceToComplete: 0,
    bosses: [],
    bossFightEnemy: null,
    jacket: 'never',
    playerFireRate: 1,
    spawnInterval: 90,
    enemySpeed: 1,
    enemyMix: { normal: 1 },
  },
  {
    id: 2,
    alley: 2,
    interior: null,
    killsToComplete: 50,
    // 30 s avanzando por el callejón (60 px/s, ver CAMERA en el cliente)
    distanceToComplete: 1800,
    bosses: ['wood'],
    bossFightEnemy: null,
    jacket: 'never',
    playerFireRate: 1,
    spawnInterval: 70,
    enemySpeed: 1.15,
    enemyMix: { normal: 5, fast: 3, heavy: 2 },
  },
  {
    id: 3,
    alley: 3,
    interior: null,
    killsToComplete: 60,
    // 40 s avanzando por el callejón
    distanceToComplete: 2400,
    bosses: ['iron'],
    bossFightEnemy: null,
    // La chupa se estrena contra el jefe (el aviso de cómo usarla sale justo antes, la primera vez)
    jacket: 'bosses',
    playerFireRate: 1,
    spawnInterval: 55,
    enemySpeed: 1.3,
    enemyMix: { normal: 3, fast: 4, heavy: 3 },
  },
  {
    id: 4,
    alley: 4,
    interior: null,
    killsToComplete: 70,
    // 50 s avanzando por el callejón
    distanceToComplete: 3000,
    // Dos pijos a la vez, que lanzan botellas hacia donde está el jugador
    bosses: ['pijo', 'pijo'],
    // Mientras, siguen llegando barriles pequeños: uno cada 9 s en Normal
    // (11,25 s en Fácil y 7,5 s en Difícil, por el spawnRate de la dificultad)
    bossFightEnemy: { type: 'barrel', spawnInterval: 540 },
    jacket: 'always',
    playerFireRate: 1,
    spawnInterval: 48,
    enemySpeed: 1.4,
    // 1 de cada 25 es un barril pequeño (4 %): unos 3 por nivel
    enemyMix: { normal: 7, fast: 9, heavy: 8, barrel: 1 },
  },
  {
    id: 5,
    // La calle del ayuntamiento: tiene final (el ayuntamiento), así que el
    // callejón se para al llegar (ver alleys en client/scripts/sprites)
    alley: 5,
    interior: null,
    // Sin mínimo de barriles: la calle tiene un largo fijo y el jefe sale al acabarla
    killsToComplete: 0,
    // 50 s avanzando por la calle: es lo que mide hasta la plaza del ayuntamiento
    distanceToComplete: 3000,
    // El primo de los pijos, que lanza barriles
    bosses: ['primo'],
    bossFightEnemy: null,
    jacket: 'always',
    // Desde aquí el protagonista dispara un 30 % más (20 pasos entre disparos -> 15 en Normal)
    playerFireRate: 1.3,
    // Uno cada 2 s: van lentos y pasan mucho rato en pantalla disparando
    spawnInterval: 120,
    enemySpeed: 1.4,
    // 3 de madera por cada uno de hierro
    enemyMix: { woodBarrel: 3, ironBarrel: 1 },
  },
  {
    id: 6,
    // Dentro del ayuntamiento: la planta baja (una fiesta con bolas de
    // discoteca) y, al acabar con sus seguratas, el despacho del alcalde
    alley: null,
    interior: { guards: 4 },
    // Las kills del nivel son los seguratas: hasta eliminarlos no se sube
    killsToComplete: 4,
    distanceToComplete: 0,
    // Una chica a cada lado y el alcalde, que sale de detrás de su mesa y al
    // que ellas protegen: los tres lanzan botellas
    bosses: ['mayor', 'blonde', 'redhead'],
    bossFightEnemy: null,
    jacket: 'always',
    playerFireRate: 1.3,
    // Bajo techo no cae nada
    spawnInterval: null,
    // Lo que lanzan los jefes va tan rápido como lo del nivel 5
    enemySpeed: 1.4,
    enemyMix: {},
  },
];

/** Nivel más alto que existe. Se deriva de LEVELS para no tener que mantenerlo a mano. */
export const MAX_LEVEL = LEVELS.length;

/** Nivel con el que empieza cualquier jugador. */
export const FIRST_LEVEL = 1;

/**
 * Primer nivel en el que se puede usar la chupa (donde se aprende). Se deriva
 * de LEVELS: si la chupa se adelanta o se retrasa, el aviso y la página de
 * Controles cambian solos.
 */
export const FIRST_JACKET_LEVEL = LEVELS.find((level) => level.jacket !== 'never')!.id;

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
