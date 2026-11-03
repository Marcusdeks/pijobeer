/**
 * CONFIGURACIÓN DEL JUEGO: todos los números que definen cómo se juega.
 *
 * Si quieres que el juego sea más fácil, más difícil o más rápido, este es
 * el ÚNICO archivo que hay que tocar. Ningún otro archivo del motor tiene
 * números "mágicos" escritos a mano (solo los tamaños de letra y pequeños
 * ajustes de posición de los textos, que son maquetación de renderer.ts).
 *
 * UNIDADES: las velocidades están en píxeles POR PASO de simulación y los
 * tiempos en PASOS. El motor ejecuta exactamente 60 pasos por segundo (ver
 * GameLoop.ts), así que 60 pasos = 1 segundo en cualquier monitor.
 *
 * Lo que cambia DE UN NIVEL A OTRO (cuántas botellas, de qué tipo, jefe...)
 * no está aquí, sino en packages/shared/src/levels.ts.
 */
import type { BossId, EnemyTypeId } from '@pijobeer/shared';

/**
 * Pasos de simulación por segundo (60). No depende de los Hz del monitor. Vive en
 * el paquete compartido porque el servidor también lo usa (antitrampas).
 */
export { SIMULATION_STEPS_PER_SECOND } from '@pijobeer/shared';

/**
 * Nunca sale más de una botella (o lata) cada este número de pasos, aunque la
 * dificultad o un truco de admin pidan un ritmo mayor: así la pantalla no se
 * llena de golpe y el juego no se atasca.
 */
export const MIN_SPAWN_INTERVAL = 10;

/** Pasos del destello blanco de un enemigo (barril pequeño o jefe) al recibir un impacto que no lo mata. */
export const HIT_FLASH_STEPS = 4;

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
 * Se puede usar siempre, salvo si para maxBlocks chorros SEGUIDOS: entonces
 * se empapa, se la quita y no vuelve a servir hasta que pasen dryingSteps
 * pasos (una barra azul lo indica). Cuentan como seguidos mientras no pase
 * más de resetSteps sin que le dé ninguno: así un chorro suelto de vez en
 * cuando no la empapa nunca, pero una ráfaga entera sí.
 */
export const JACKET = {
  maxBlocks: 3,
  /** 120 pasos = 2 s secándose. */
  dryingSteps: 120,
  /** 60 pasos = 1 s sin recibir ningún chorro y la cuenta vuelve a empezar. */
  resetSteps: 60,
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
  /**
   * Cuánto se concentran en el centro al aparecer (es donde suele moverse el
   * jugador): la posición es la MEDIA de este número de sorteos. 1 = repartidas
   * por igual en todo el ancho; 2 = en forma de triángulo, sobre todo por el
   * centro y pocas pegadas a las paredes; cuanto más alto, más al centro.
   */
  spawnCenterBias: 2,
  /** Distancia entre el cuello de la botella y la bala al salir, para que no nazca dentro de la botella. */
  bulletGap: 6,
  /** Vida que quita una bala enemiga. */
  bulletDamage: 10,
  /** Vida que quita chocar contra una botella (la botella muere en el choque). */
  contactDamage: 20,
} as const;

/**
 * Lo común a todas las botellas: su caja de colisión (ver ENEMY), un solo
 * chorro recto hacia abajo y el primer disparo entre 1 y 2 s después de aparecer.
 */
const BOTTLE = {
  kind: 'bottle',
  firstShot: [60, 120],
  aimed: false,
  streams: 1,
  spreadDeg: 0,
  width: ENEMY.width,
  height: ENEMY.height,
} as const;

/**
 * Lo común a todos los barriles pequeños: apuntan al jugador, disparan nada
 * más entrar en pantalla (entre 0,25 y 0,5 s) y su caja es el dibujo
 * (barrel-minion.json, 34x44) sin los bordes redondeados.
 */
const BARREL = {
  kind: 'barrel',
  firstShot: [15, 30],
  aimed: true,
  width: 30,
  height: 40,
} as const;

/**
 * TIPOS DE ENEMIGO. Cada nivel decide en qué proporción salen (enemyMix en
 * packages/shared/src/levels.ts). El dibujo indica el tipo, para que el
 * jugador sepa de un vistazo qué le viene encima.
 *
 *   kind          'bottle' = botella (dispara con la animación de la chapa);
 *                 'barrel' = barril (dispara sin animación)
 *   variant       su dibujo: el color en la hoja de botellas, o la madera o
 *                 el hierro en la de barriles
 *   speed         píxeles por paso de caída (antes del multiplicador del nivel)
 *   shootCooldown pasos de espera entre el final de un disparo y el siguiente
 *   hits          abrechapas que aguanta (los puntos de cada uno, en ENEMY_POINTS)
 *   firstShot     [mín, máx] pasos hasta el primer disparo; se sortea un valor entre
 *                 los dos para que no disparen todos a la vez
 *   aimed         true = dispara hacia donde está el jugador; false = recto hacia abajo
 *   streams       chorros por disparo, en abanico de spreadDeg grados (como los jefes)
 *   width/height  caja de colisión
 */
export const ENEMY_TYPES = {
  /** La de siempre. */
  normal: { ...BOTTLE, variant: 'pink', speed: 2, shootCooldown: 90, hits: 1 },
  /** Rápida: baja más deprisa, dispara como la normal. */
  fast: { ...BOTTLE, variant: 'gold', speed: 3.2, shootCooldown: 90, hits: 1 },
  /**
   * Pesada: lenta, pero dispara mucho más. Con la animación de disparo (24
   * pasos) y 10 de espera, hace unos 1,8 disparos por segundo (la normal, 0,5).
   */
  heavy: { ...BOTTLE, variant: 'dark', speed: 1.3, shootCooldown: 10, hits: 1 },
  /**
   * Barril pequeño del nivel 4: el más lento de todos y aguanta 3 impactos.
   * Al ir tan despacio pasa mucho rato en pantalla, así que es una amenaza
   * constante: un disparo apuntado cada 75 pasos (1,25 s).
   */
  barrel: {
    ...BARREL,
    variant: 'wood',
    speed: 0.7,
    shootCooldown: 75,
    hits: 3,
    streams: 1,
    spreadDeg: 0,
  },
  /**
   * Barril de madera del nivel 5 (también los lanza el primo): como el del
   * nivel 4, pero cada disparo son 3 chorros en abanico hacia el jugador, a
   * 20° entre sí. Para compensar, dispara algo menos: cada 2 s.
   */
  woodBarrel: {
    ...BARREL,
    variant: 'wood',
    speed: 0.7,
    shootCooldown: 120,
    hits: 3,
    streams: 3,
    spreadDeg: 40,
  },
  /**
   * Barril de hierro del nivel 5: más lento y más duro (5 impactos), y cada
   * disparo son 5 chorros a 15° entre sí, cada 2,5 s.
   */
  ironBarrel: {
    ...BARREL,
    variant: 'iron',
    speed: 0.6,
    shootCooldown: 150,
    hits: 5,
    streams: 5,
    spreadDeg: 60,
  },
} as const satisfies Record<
  EnemyTypeId,
  {
    kind: 'bottle' | 'barrel';
    variant: string;
    speed: number;
    shootCooldown: number;
    firstShot: readonly [number, number];
    hits: number;
    aimed: boolean;
    streams: number;
    spreadDeg: number;
    width: number;
    height: number;
  }
>;

/** Cómo vuela algo que lanza un jefe (ver THROWN). */
export interface ThrowStats {
  /** Píxeles por paso. */
  readonly speed: number;
  /** Pasos hasta que empieza su primer disparo. */
  readonly firstShot: number;
  /** De qué tipos pueden ser (se elige uno al azar en cada lanzamiento). */
  readonly types: readonly EnemyTypeId[];
}

/**
 * LO QUE LANZAN LOS JEFES: enemigos normales de un tipo al azar (disparan
 * como su tipo), pero en vez de caer rectos salen en línea recta hacia donde
 * ESTABA el jugador al lanzarlos: no le persiguen (nada cambia de rumbo en el
 * aire), así que moverse a tiempo basta para esquivarlos.
 */
export const THROWN = {
  /**
   * Botellas de los pijos (nivel 4): más rápidas que cualquier botella que
   * cae. Empiezan a disparar enseguida: les salta la chapa a los 3 pasos y la
   * espuma sale 12 después (ver ENEMY.fireOnFrame), a los 0,25 s de lanzarlas.
   * Si esperasen como una botella normal, a esta velocidad llegarían al
   * jugador sin haber disparado nunca.
   */
  bottles: { speed: 5, firstShot: 3, types: ['normal', 'fast', 'heavy'] },
  /**
   * Barriles del primo (nivel 5): lentos, y disparan su abanico a los 0,5 s
   * de lanzarlos. Lo peligroso no es el barril, sino lo que dispara mientras llega.
   */
  barrels: { speed: 1.5, firstShot: 30, types: ['woodBarrel', 'ironBarrel'] },
} as const satisfies Record<string, ThrowStats>;

/**
 * JEFES FINALES. Aparecen cuando se cumple el objetivo de un nivel con jefe
 * (en el nivel 4, dos a la vez). Entran desde arriba, se quedan a la altura
 * holdY moviéndose de pared a pared, y atacan en RÁFAGAS: burstSize ataques
 * seguidos (separados burstGap pasos) y después una pausa de burstPause pasos.
 * Se les gana bajándoles la vida a 0 (cada abrechapas quita PLAYER_BULLET.damage).
 *
 * Mientras atacan NO se mueven: se paran windupSteps pasos antes de la ráfaga
 * (el pijo coge impulso; el primo se agacha a por el barril y lo levanta),
 * durante toda ella y recoverSteps pasos después. Ese rato quietos es el
 * momento de acertarles.
 *
 *   attack      'foam' = chorros de espuma; 'bottles' o 'barrels' = lanza eso (ver THROWN)
 *   streams     cuántos chorros de espuma salen en cada ataque (los que lanzan cosas, una cada vez)
 *   spreadDeg   apertura total del abanico, en grados (0 = todos juntos)
 *   aimed       true = el abanico apunta al jugador; false = hacia abajo
 *
 * Y lo que cambia en la fase de furia (ver BOSS_ENRAGE):
 *   enragedExtraStreams    chorros de más por disparo
 *   enragedExtraSpreadDeg  apertura de más, para repartir los chorros nuevos
 *   enragedPauseScale      multiplica la pausa entre ráfagas (< 1 = más ráfagas)
 */
interface BossStats {
  attack: 'foam' | keyof typeof THROWN;
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
  windupSteps: number;
  recoverSteps: number;
}

/**
 * PERFIL BASE de los jefes: los valores NEUTROS, los de "esta capacidad no la
 * tiene" (un solo chorro, sin abanico, sin apuntar, sin ráfagas, la furia no
 * cambia su ataque y no se para antes ni después de atacar).
 *
 * Cada jefe empieza copiándolo (...BOSS_BASE) y escribe encima solo lo que le
 * hace distinto. Así cada valor está en un único sitio: si un jefe no lo
 * menciona, tiene el neutro. Lo que no tiene un valor neutro con sentido
 * (ataque, vida, tamaño, velocidad y pausa) no está aquí: TypeScript obliga a
 * que cada jefe lo escriba.
 */
const BOSS_BASE = {
  burstSize: 1,
  burstGap: 0,
  streams: 1,
  spreadDeg: 0,
  aimed: false,
  enragedExtraStreams: 0,
  enragedExtraSpreadDeg: 0,
  enragedPauseScale: 1,
  windupSteps: 0,
  recoverSteps: 0,
} as const satisfies Partial<BossStats>;

export const BOSS = {
  /** Madera: apunta al jugador. Quedarse quieto es recibir toda la ráfaga. */
  wood: {
    ...BOSS_BASE,
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
    ...BOSS_BASE,
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
   * Pijo (nivel 4, salen dos): lanza una botella cada 1,8 s, de un tipo al
   * azar. Con furia, una cada 0,9 s. Mide lo mismo que el protagonista.
   * Los dos se turnan (ver Boss.waitTurn): nunca lanzan a la vez.
   */
  pijo: {
    ...BOSS_BASE,
    attack: 'bottles',
    health: 100,
    /** Caja de colisión: la misma que la del jugador (ver PLAYER). */
    width: 30,
    height: 64,
    speed: 2,
    burstPause: 108,
    aimed: true,
    enragedPauseScale: 0.5,
    /** Brazo arriba con la botella (aviso de que va a lanzar) y brazo estirado tras lanzarla. */
    windupSteps: 20,
    recoverSteps: 15,
  },
  /**
   * Primo pijo (nivel 5): un grandullón lento y con mucha vida que lanza un
   * barril cada 2,5 s (con furia, cada 1,75 s), de madera o de hierro al azar.
   * Los barriles van despacio, pero disparan su abanico mientras llegan.
   */
  primo: {
    ...BOSS_BASE,
    attack: 'barrels',
    health: 300,
    /** Caja de colisión: el cuerpo (el dibujo de andar mide 120x120, con los brazos abiertos). */
    width: 70,
    height: 110,
    speed: 1.5,
    burstPause: 150,
    aimed: true,
    enragedPauseScale: 0.7,
    /**
     * Se agacha a por el barril, lo levanta y lo sube sobre la cabeza: 4
     * poses de 12 pasos (0,8 s de aviso). Al lanzar, 2 poses más: soltándolo
     * y con las manos vacías.
     */
    windupSteps: 48,
    recoverSteps: 24,
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
  /** Vida que quita al jugador si se le acerca demasiado. */
  contactDamage: 20,
  /** Pasos sin volver a hacer daño por contacto (si no, quitaría 20 de vida en cada paso). */
  contactCooldown: 45,
  /** Pasos por frame al andar de lado (el pijo alterna sus dos pasos; el primo, cuatro). */
  walkFrameSteps: 12,
} as const;

/**
 * FINAL DEL NIVEL 5, delante del ayuntamiento. La calle se acaba (el callejón
 * deja de avanzar al llegar a la plaza) y, al derrotar al jefe, el
 * protagonista entra solo en el ayuntamiento por la puerta del centro (dónde
 * está, en assets/sprites/alleys.json: la mide el script de sprites).
 */
export const FINALE = {
  /**
   * El camión aparcado en la plaza, detrás del jefe y a un lado: su esquina
   * de arriba a la izquierda, en píxeles de pantalla con la plaza ya a la
   * vista. Queda a la derecha de la puerta, que sigue libre para pasar.
   */
  truck: { x: 470, y: 20 },
  /** Píxeles por paso al entrar andando en el ayuntamiento (algo más despacio que jugando). */
  exitSpeed: 3,
  /**
   * Píxeles que sigue andando desde la entrada, ya bajo el arco, mientras
   * desaparece en lo oscuro de la puerta (90 a 3 por paso = medio segundo).
   */
  vanishDistance: 90,
  /** Pasos del fundido a negro de la pantalla, cuando ya ha desaparecido (60 = 1 s). */
  fadeSteps: 60,
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
  /** Probabilidad de que la lata sea la verde (cura); si no, la de leopardo (velocidad). */
  healthChance: 0.5,
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

/**
 * BARRAS que se dibujan en el canvas (tamaños en píxeles).
 *   player  sobre la cabeza del jugador: la de vida y, apiladas encima, las del
 *           acelerón y la chupa secándose (separadas stackGap)
 *   boss    la de los jefes, arriba en el centro
 *   border  grosor del marco oscuro que rodea cada barra
 */
export const HUD_BARS = {
  player: { width: 36, height: 4, gap: 6, stackGap: 2, border: 1 },
  boss: { width: 320, height: 10, top: 48, border: 2 },
  /** % de vida desde el que la barra del jugador es verde, y desde el que es amarilla (por debajo, roja). */
  healthyAt: 75,
  hurtAt: 25,
} as const;

/** Paleta de colores del canvas. */
export const COLORS = {
  playerHealthy: '#00ff00', // vida >= HUD_BARS.healthyAt
  playerHurt: '#ffff00', // vida >= HUD_BARS.hurtAt
  playerCritical: '#ff0000', // el resto
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
  /** Fundido a negro al entrar en el ayuntamiento (final del nivel 5). */
  fade: '#000000',
  gameOver: '#ff0000',
  bossHealth: '#ff3b3b',
  /** Barra del jefe en fase de furia. */
  bossEnraged: '#ff00c8',
  /** Marco oscuro de las barras del jugador y de los jefes. */
  playerBarFrame: 'rgba(0, 0, 0, 0.6)',
  bossBarFrame: 'rgba(0, 0, 0, 0.7)',
  /** Fondo mientras se descarga la imagen del callejón. */
  background: '#1a1418',
} as const;

/** Milisegundos que se muestra "GAME OVER" antes de volver al menú. */
export const GAME_OVER_DELAY_MS = 2000;
