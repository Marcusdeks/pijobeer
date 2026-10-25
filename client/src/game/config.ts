/**
 * CONFIGURACIÓN DEL JUEGO: todos los números que definen cómo se juega.
 *
 * Si quieres que el juego sea más fácil, más difícil o más rápido, este es
 * el ÚNICO archivo que hay que tocar. Ningún otro archivo del motor tiene
 * números "mágicos" escritos a mano.
 *
 * UNIDADES: las velocidades están en píxeles POR PASO de simulación y los
 * tiempos en PASOS. El motor ejecuta exactamente 60 pasos por segundo (ver
 * GameLoop.ts), así que 60 pasos = 1 segundo en cualquier monitor.
 *
 * Lo que cambia DE UN NIVEL A OTRO (cuántas botellas, de qué tipo, jefe...)
 * no está aquí, sino en packages/shared/src/levels.ts.
 */
import type { BossId, EnemyTypeId } from '@pijobeer/shared';

/** Pasos de simulación por segundo. No depende de los Hz del monitor. */
export const SIMULATION_STEPS_PER_SECOND = 60;

/** Tamaño lógico del área de juego, en píxeles. */
export const ARENA = {
  width: 800,
  height: 500,
} as const;

/**
 * TECLAS. Se comparan en minúsculas con el valor de KeyboardEvent.key.
 * Para teclas especiales usa el nombre del navegador: 'arrowleft', 'arrowup', ' ' (espacio)...
 * La página de Controles lee este objeto, así que nunca puede quedar desactualizada.
 */
export const CONTROLS = {
  left: 'a',
  right: 'd',
  up: 'w',
  down: 's',
  shoot: 'v',
  pause: 'p',
} as const;

export type GameAction = keyof typeof CONTROLS;

export const PLAYER = {
  /**
   * Caja de colisión ("hitbox"): el rectángulo con el que se calculan los
   * impactos. NO es el tamaño del dibujo: el sprite mide 64x80 pero tiene
   * mucho hueco transparente alrededor. La caja cubre el cuerpo, de la cabeza
   * a los pies, para que una bala que pasa "por el aire" junto al personaje
   * no cuente como impacto. La base de la caja coincide con los pies del sprite.
   */
  width: 30,
  height: 64,
  /**
   * Lo más arriba que puede subir la caja de colisión. No es 0 porque el
   * dibujo y la barra de vida sobresalen por encima de la caja: con 0 se
   * saldrían del canvas y la cabeza quedaría cortada.
   */
  topMargin: 12,
  speed: 5,
  maxHealth: 100,
  /** Pasos entre disparo y disparo (15 = 4 disparos por segundo). */
  shootCooldown: 15,
  /** Distancia entre la parte de arriba del jugador y el borde inferior al empezar (deja 16 px bajo los pies). */
  spawnBottomOffset: 80,
} as const;

/**
 * BOTELLAS: lo común a todos los tipos.
 */
export const ENEMY = {
  /**
   * Caja de colisión: la botella cerrada (en enemy-bottles.json mide 18x46),
   * con 2 px de margen a lo ancho para que no sea frustrante acertarle.
   * La espuma que sale al disparar NO forma parte de la caja.
   */
  width: 20,
  height: 46,
  /**
   * El primer disparo de cada botella llega tras un retraso aleatorio entre
   * estos dos valores. Si no, todas dispararían sincronizadas.
   */
  firstShotDelayMin: 60,
  firstShotDelayMax: 120,
  /**
   * Animación de disparo: frames de la hoja que se reproducen al disparar
   * (1 salta la chapa · 2 explota la espuma · 3 gotea · 4 abierta). Fuera
   * de la animación, la botella está en el frame 0 (cerrada).
   */
  shootAnimation: [1, 2, 3, 4],
  /** Pasos que dura cada frame de la animación de disparo (6 = 100 ms). */
  shootFrameSteps: 6,
  /**
   * Frame en el que sale la bala: el de la explosión de espuma. Así el salto
   * de la chapa (frame anterior) avisa al jugador de que viene un disparo.
   */
  fireOnFrame: 2,
  /** Distancia entre el cuello de la botella y la bala al salir, para que no nazca dentro de la botella. */
  bulletGap: 6,
  /** Vida que quita una bala enemiga. */
  bulletDamage: 10,
  /** Vida que quita chocar contra una botella (la botella muere en el choque). */
  contactDamage: 20,
} as const;

/**
 * TIPOS DE BOTELLA. Cada nivel decide en qué proporción salen (enemyMix en
 * packages/shared/src/levels.ts). El color de la botella indica su tipo, para
 * que el jugador sepa de un vistazo qué le viene encima.
 *
 *   speed         píxeles por paso de caída (antes del multiplicador del nivel)
 *   shootCooldown pasos de espera entre el final de un disparo y el siguiente
 *   variant       color en la hoja de sprites
 */
export const ENEMY_TYPES = {
  /** La de siempre. */
  normal: { speed: 2, shootCooldown: 90, variant: 'pink' },
  /** Rápida: baja más deprisa, dispara como la normal. */
  fast: { speed: 3.2, shootCooldown: 90, variant: 'gold' },
  /** Pesada: lenta, pero dispara el doble (espera menos de la mitad entre disparos). */
  heavy: { speed: 1.3, shootCooldown: 33, variant: 'dark' },
} as const satisfies Record<EnemyTypeId, { speed: number; shootCooldown: number; variant: string }>;

/**
 * JEFES FINALES (barriles). Aparecen cuando se cumple el objetivo de botellas
 * de un nivel con jefe. Entran desde arriba, se quedan a la altura holdY
 * moviéndose de pared a pared, y disparan en RÁFAGAS: burstSize disparos
 * seguidos (separados burstGap pasos) y después una pausa de burstPause pasos.
 * Se les gana bajándoles la vida a 0 (cada abrechapas quita 1).
 */
export const BOSS = {
  blonde: {
    health: 30,
    /** Caja de colisión (el dibujo mide 80x104; se recortan los bordes redondeados). */
    width: 70,
    height: 96,
    /** Píxeles por paso de lado a lado. */
    speed: 1.6,
    burstSize: 3,
    burstGap: 8,
    burstPause: 70,
    /** Chorros por disparo y separación horizontal entre ellos. */
    streams: 1,
    streamSpacing: 0,
  },
  dark: {
    health: 50,
    width: 70,
    height: 96,
    speed: 2.2,
    burstSize: 5,
    burstGap: 6,
    burstPause: 60,
    streams: 2,
    streamSpacing: 28,
  },
} as const satisfies Record<BossId, object>;

/** Lo común a todos los jefes. */
export const BOSS_COMMON = {
  /** Velocidad de entrada desde arriba. */
  enterSpeed: 1.5,
  /** Hasta dónde baja antes de empezar a moverse (deja sitio a su barra de vida). */
  holdY: 70,
  /** Velocidad de sus chorros de espuma. */
  bulletSpeed: 6,
  /** Vida que quita al jugador si se le acerca demasiado. */
  contactDamage: 20,
  /** Pasos sin volver a hacer daño por contacto (si no, quitaría 20 de vida en cada paso). */
  contactCooldown: 45,
  /** Pasos que dura el destello blanco al recibir un impacto. */
  hitFlashSteps: 4,
} as const;

/** Píxeles por paso que se desplaza el fondo del callejón. */
export const SCROLL_SPEED = 0.9;

/**
 * Balas. El tamaño es el de la CAJA DE COLISIÓN, más pequeña que el dibujo:
 *   - jugador: el aro del abrechapas (las llamas no cuentan).
 *   - enemigo: la cabeza del chorro de espuma (la estela no cuenta).
 */
export const PLAYER_BULLET = {
  width: 12,
  height: 14,
  /** Píxeles por paso, hacia arriba. */
  speed: 8,
  /** Pasos por frame de la animación de las llamas. */
  frameSteps: 5,
} as const;

export const ENEMY_BULLET = {
  width: 10,
  height: 12,
  /** Píxeles por paso, hacia abajo. */
  speed: 5,
  /** Pasos por frame de la animación del chorro. */
  frameSteps: 5,
} as const;

/** Paleta de colores del canvas. */
export const COLORS = {
  playerHealthy: '#00ff00', // vida >= 75 %
  playerHurt: '#ffff00', // vida >= 25 %
  playerCritical: '#ff0000', // vida < 25 %
  playerBullet: '#ffffff',
  enemy: '#aa00ff',
  enemyBullet: '#ff0000',
  hud: '#ffffff',
  overlay: 'rgba(0, 0, 0, 0.7)',
  gameOver: '#ff0000',
  bossHealth: '#ff3b3b',
  /** Fondo mientras se descarga la imagen del callejón. */
  background: '#1a1418',
} as const;

/** Milisegundos que se muestra "GAME OVER" antes de volver al menú. */
export const GAME_OVER_DELAY_MS = 2000;
