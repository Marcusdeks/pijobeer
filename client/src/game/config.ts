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
  /** Mantener pulsada para protegerse con la chupa (en los niveles que lo permiten). */
  shield: 'b',
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
   * Lo más arriba que puede subir la caja de colisión: media pantalla. Así el
   * personaje no se mete entre lo que le cae encima; a partir de esa línea,
   * si sigue avanzando con W, es el callejón el que corre más (ver CAMERA).
   */
  minY: ARENA.height / 2,
  speed: 5,
  maxHealth: 100,
  /**
   * Pasos entre disparo y disparo en dificultad normal (20 = 3 disparos por
   * segundo). La dificultad lo multiplica (fireRate en difficulty.ts).
   */
  shootCooldown: 20,
  /** Distancia entre la parte de arriba del jugador y el borde inferior al empezar (deja 16 px bajo los pies). */
  spawnBottomOffset: 80,
} as const;

/**
 * LA CHUPA: manteniendo la B, el jugador se tapa con ella y la espuma no le
 * hace daño. Solo en los niveles que lo permiten (jacket en levels.ts).
 *
 * Mientras se tapa no puede moverse ni disparar (tiene las manos ocupadas) y
 * el callejón no avanza. Solo para la ESPUMA: los botellazos (chocar con una
 * botella o con un jefe) hacen daño igual.
 *
 * Tras parar maxBlocks chorros se empapa y se la quita: no vuelve a servir
 * hasta que pasen dryingSteps pasos (una barra azul lo indica).
 */
export const JACKET = {
  maxBlocks: 3,
  /** 300 pasos = 5 s secándose. */
  dryingSteps: 300,
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

/** Caja de colisión de cualquier botella (ver ENEMY). */
const BOTTLE_BOX = { width: ENEMY.width, height: ENEMY.height } as const;

/**
 * TIPOS DE ENEMIGO. Cada nivel decide en qué proporción salen (enemyMix en
 * packages/shared/src/levels.ts). El dibujo indica el tipo, para que el
 * jugador sepa de un vistazo qué le viene encima.
 *
 *   speed         píxeles por paso de caída (antes del multiplicador del nivel)
 *   shootCooldown pasos de espera entre el final de un disparo y el siguiente
 *   hits          abrechapas que aguanta (los puntos de cada uno, en ENEMY_POINTS)
 *   aimed         true = dispara hacia donde está el jugador; false = recto hacia abajo
 *   variant       color en la hoja de botellas (null = no es una botella)
 *   width/height  caja de colisión
 */
export const ENEMY_TYPES = {
  /** La de siempre. */
  normal: { speed: 2, shootCooldown: 90, hits: 1, aimed: false, variant: 'pink', ...BOTTLE_BOX },
  /** Rápida: baja más deprisa, dispara como la normal. */
  fast: { speed: 3.2, shootCooldown: 90, hits: 1, aimed: false, variant: 'gold', ...BOTTLE_BOX },
  /** Pesada: lenta, pero dispara el doble (espera menos de la mitad entre disparos). */
  heavy: { speed: 1.3, shootCooldown: 33, hits: 1, aimed: false, variant: 'dark', ...BOTTLE_BOX },
  /**
   * Barril pequeño (nivel 4): a la velocidad de la pesada, aguanta 3 impactos y
   * apunta al jugador. Dispara menos que una botella porque no hay que esquivar
   * solo su espuma: también hay que gastar tres disparos en él.
   * Caja: el dibujo (barrel-minion.json, 34x44) sin los bordes redondeados.
   */
  barrel: {
    speed: 1.3,
    shootCooldown: 150,
    hits: 3,
    aimed: true,
    variant: null,
    width: 30,
    height: 40,
  },
} as const satisfies Record<
  EnemyTypeId,
  {
    speed: number;
    shootCooldown: number;
    hits: number;
    aimed: boolean;
    variant: string | null;
    width: number;
    height: number;
  }
>;

/**
 * BOTELLAS LANZADAS por los pijos (jefes del nivel 4). Son botellas normales
 * de un tipo al azar (disparan como su tipo, hacia donde van), pero en vez
 * de caer rectas van a por el jugador girando poco a poco: con un giro
 * máximo por paso pequeño, un cambio de dirección a tiempo basta para
 * esquivarlas. Cuando ya han pasado al jugador dejan de girar y siguen recto.
 */
export const THROWN_BOTTLE = {
  /** Píxeles por paso. */
  speed: 3,
  /** Grados que puede girar como mucho en cada paso. */
  turnDeg: 1.2,
} as const;

/**
 * JEFES FINALES. Aparecen cuando se cumple el objetivo de un nivel con jefe
 * (en el nivel 4, dos a la vez). Entran desde arriba, se quedan a la altura
 * holdY moviéndose de pared a pared, y atacan en RÁFAGAS: burstSize ataques
 * seguidos (separados burstGap pasos) y después una pausa de burstPause pasos.
 * Se les gana bajándoles la vida a 0 (cada abrechapas quita PLAYER_BULLET.damage).
 *
 *   attack      'foam' = chorros de espuma; 'bottles' = lanza botellas teledirigidas
 *   streams     cuántos chorros (o botellas) salen en cada ataque
 *   spreadDeg   apertura total del abanico, en grados (0 = todos juntos)
 *   aimed       true = el abanico apunta al jugador; false = hacia abajo
 *
 * Y lo que cambia en la fase de furia (ver BOSS_ENRAGE):
 *   enragedExtraStreams    chorros de más por disparo
 *   enragedExtraSpreadDeg  apertura de más, para repartir los chorros nuevos
 *   enragedPauseScale      multiplica la pausa entre ráfagas (< 1 = más ráfagas)
 */
interface BossStats {
  attack: 'foam' | 'bottles';
  health: number;
  width: number;
  height: number;
  speed: number;
  burstSize: number;
  burstGap: number;
  burstPause: number;
  streams: number;
  spreadDeg: number;
  aimed: boolean;
  enragedExtraStreams: number;
  enragedExtraSpreadDeg: number;
  enragedPauseScale: number;
}

export const BOSS = {
  /** Madera: apunta al jugador. Quedarse quieto es recibir toda la ráfaga. */
  wood: {
    attack: 'foam',
    health: 80,
    /** Caja de colisión (el dibujo mide 80x104; se recortan los bordes redondeados). */
    width: 70,
    height: 96,
    /** Píxeles por paso de lado a lado. */
    speed: 2.4,
    burstSize: 5,
    burstGap: 6,
    burstPause: 45,
    streams: 1,
    spreadDeg: 0,
    aimed: true,
    enragedExtraStreams: 2,
    enragedExtraSpreadDeg: 30,
    /**
     * Con furia hace la MITAD de ráfagas que antes (del mismo tamaño): cada
     * ráfaga dura 24 pasos, así que con la pausa a 68 (45 × 1,5) va una cada
     * 92 pasos en vez de una cada 46 (24 + 45 × 0,5).
     */
    enragedPauseScale: 1.5,
  },
  /**
   * Hierro: abanico que apunta al jugador. Pocos chorros y bien separados
   * (25° entre uno y otro) para que haya hueco por donde colarse: la
   * dificultad está en su vida y en no parar de moverse, no en un muro de espuma.
   */
  iron: {
    attack: 'foam',
    health: 140,
    width: 70,
    height: 96,
    speed: 3,
    burstSize: 3,
    burstGap: 8,
    burstPause: 50,
    streams: 3,
    spreadDeg: 50,
    aimed: true,
    /** Con furia, 4 chorros en 70°: siguen saliendo a más de 20° entre sí. */
    enragedExtraStreams: 1,
    enragedExtraSpreadDeg: 20,
    enragedPauseScale: 0.5,
  },
  /**
   * Pijo (nivel 4, salen dos): lanza una botella teledirigida cada 2 s, de un
   * tipo al azar. Con furia, una cada segundo.
   */
  pijo: {
    attack: 'bottles',
    health: 100,
    /** Caja de colisión (el dibujo mide 60x96; se recortan los brazos). */
    width: 44,
    height: 88,
    speed: 2,
    burstSize: 1,
    burstGap: 1,
    burstPause: 120,
    streams: 1,
    spreadDeg: 0,
    aimed: true,
    enragedExtraStreams: 0,
    enragedExtraSpreadDeg: 0,
    enragedPauseScale: 0.5,
  },
} as const satisfies Record<BossId, BossStats>;

/**
 * FASE DE FURIA: al bajar de enrageAt de su vida (0,2 = le queda un 20 %), el
 * jefe se enfada: se mueve más rápido y cambia su ritmo de ataque (lo de cada
 * jefe, en BOSS). Su barra de vida cambia de color para avisar al jugador.
 */
export const BOSS_ENRAGE = {
  enrageAt: 0.2,
  speedScale: 1.4,
} as const;

/** Lo común a todos los jefes. */
export const BOSS_COMMON = {
  /** Velocidad de entrada desde arriba. */
  enterSpeed: 1.5,
  /** Hasta dónde baja antes de empezar a moverse (deja sitio a su barra de vida). */
  holdY: 70,
  /** Velocidad de sus chorros de espuma (píxeles por paso, en la dirección del disparo). */
  bulletSpeed: 6,
  /**
   * Ángulo máximo respecto a la vertical al apuntar, en grados. Sin este tope,
   * pegado a una pared el jugador recibiría disparos casi horizontales,
   * imposibles de esquivar.
   */
  maxAimDeg: 55,
  /**
   * Durante el combate siguen cayendo botellas, pero más despacio: el ritmo
   * del nivel multiplicado por este número (2 = la mitad de botellas).
   */
  minionSpawnFactor: 2,
  /** Vida que quita al jugador si se le acerca demasiado. */
  contactDamage: 20,
  /** Pasos sin volver a hacer daño por contacto (si no, quitaría 20 de vida en cada paso). */
  contactCooldown: 45,
  /** Pasos que dura el destello blanco al recibir un impacto. */
  hitFlashSteps: 4,
} as const;

/**
 * LATAS que se recogen al tocarlas. Caen cada cierto tiempo, se alternan al
 * azar y las balas las atraviesan (no se pueden romper sin querer).
 *
 * Cada cuántas salen y cuánto cura la verde dependen además de la dificultad
 * (pickupRate y pickupHeal en packages/shared/src/difficulty.ts).
 */
export const PICKUP = {
  /** Caja de colisión: el dibujo entero (pickups.json), con 1 px más a lo ancho para que cueste menos cogerla. */
  width: 20,
  height: 34,
  /** Más lentas que cualquier botella: hay que poder llegar a ellas. */
  fallSpeed: 1.2,
  /** Pasos entre lata y lata en dificultad normal (900 = 15 s). */
  spawnInterval: 900,
} as const;

export const PICKUP_TYPES = {
  /** Verde: cura. Un cuarto de la vida: ayuda, pero no salva una partida mala. */
  health: { heal: 25 },
  /** Leopardo: durante un rato el jugador dispara el doble de rápido. */
  speed: { fireRateScale: 2, durationSteps: 360 },
} as const;

export type PickupTypeId = keyof typeof PICKUP_TYPES;

/**
 * CÁMARA: cómo se avanza por el callejón. Funciona como una cinta de correr:
 *   - Mirando RECTO hacia delante (arriba) sin pulsar nada, el callejón avanza
 *     solo y el personaje corre en el sitio (advanceSpeed).
 *   - Manteniendo W, esprinta (sprintSpeed). Al llegar a media pantalla ya no
 *     sube más (PLAYER.minY) y, si sigue pulsando W, el callejón va aún más
 *     rápido (lineSpeed).
 *   - En diagonal (W+A o W+D) solo avanza mientras se pulsa, nunca solo, y más
 *     despacio que recto (diagonalScale): parte del paso se va hacia el lado.
 *   - Mirando a un lado o hacia atrás, se para. Contra el jefe tampoco avanza.
 * El jugador puede moverse por toda su mitad de la pantalla para esquivar.
 *
 * Botellas, latas y balas enemigas caen a su propia velocidad (la que marcan
 * el nivel y la dificultad) MÁS lo que avance el callejón en ese paso (ver
 * GameSession): si el jugador avanza, todo le viene encima más deprisa y nunca
 * parece quieto o que se aleja con el suelo. Parado, caen a su ritmo.
 */
export const CAMERA = {
  /** Píxeles por paso que avanza el callejón (1 = 60 píxeles por segundo). */
  advanceSpeed: 1,
  /** Píxeles por paso al esprintar con W (2,5 = 150 píxeles por segundo): se llega antes al jefe. */
  sprintSpeed: 2.5,
  /** Píxeles por paso esprintando ya pegado a media pantalla (4 = 240 píxeles por segundo). */
  lineSpeed: 4,
  /** Multiplicador de las dos anteriores al avanzar en diagonal (0,7 = un 30 % más despacio). */
  diagonalScale: 0.7,
} as const;

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
  /**
   * Vida que quita a un jefe cada abrechapas (5 = el de madera cae en 16
   * impactos y el de hierro en 28). A las botellas y barriles pequeños no les
   * afecta: cuentan impactos (hits en ENEMY_TYPES).
   */
  damage: 5,
  /** Pasos por frame de la animación de las llamas. */
  frameSteps: 5,
} as const;

export const ENEMY_BULLET = {
  width: 10,
  height: 12,
  /** Píxeles por paso, hacia abajo (más lo que avance el callejón: ver CAMERA). */
  speed: 5,
  /** Pasos por frame de la animación del chorro. */
  frameSteps: 5,
} as const;

/** Paleta de colores del canvas. */
export const COLORS = {
  playerHealthy: '#00ff00', // vida >= 75 %
  playerHurt: '#ffff00', // vida >= 25 %
  playerCritical: '#ff0000', // vida < 25 %
  /** Barra del acelerón de la lata de velocidad. */
  playerBoost: '#ffc400',
  /** Barra de la chupa mientras se seca. */
  jacketDrying: '#3fa9ff',
  /** Lata mientras se descarga su imagen. */
  pickup: '#3fbf3f',
  playerBullet: '#ffffff',
  enemy: '#aa00ff',
  enemyBullet: '#ff0000',
  hud: '#ffffff',
  overlay: 'rgba(0, 0, 0, 0.7)',
  gameOver: '#ff0000',
  bossHealth: '#ff3b3b',
  /** Barra del jefe en fase de furia. */
  bossEnraged: '#ff00c8',
  /** Fondo mientras se descarga la imagen del callejón. */
  background: '#1a1418',
} as const;

/** Milisegundos que se muestra "GAME OVER" antes de volver al menú. */
export const GAME_OVER_DELAY_MS = 2000;
