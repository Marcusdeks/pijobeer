/**
 * CATÁLOGO DE ANIMACIONES: todas las animaciones del juego, en un formato
 * común, para la página de prueba de animaciones del admin.
 *
 * Cada hoja de sprites tiene su propio formato (el jugador, 8 direcciones; el
 * primo, una fila por animación; las botellas, una fila por color...). Aquí se
 * convierten todas en lo mismo: una lista de frames, cada uno con los pasos de
 * simulación que dura. Los recortes salen de las MISMAS funciones que usa el
 * renderer (playerFrame, primoFrame...) y los tiempos y las cajas de colisión,
 * de config.ts: lo que se ve en la página es lo que sale en el juego.
 *
 * Como el resto de sprites/, solo tiene DATOS: las imágenes las carga la página.
 */
import { BRAND } from '../../brand';
import {
  BOSS,
  BOSS_COMMON,
  CITY_HALL,
  ENEMY,
  ENEMY_BULLET,
  ENEMY_TYPES,
  PICKUP,
  PLAYER,
  PLAYER_BULLET,
} from '../config';
import { DIRECTIONS, type Direction } from '../direction';
import type { BossPose } from '../entities/Boss';
import type { DancerAction } from '../entities/Dancer';
import foamMeta from '../../assets/sprites/bullet-foam.json';
import cityHallMeta from '../../assets/sprites/city-hall.json';
import openerMeta from '../../assets/sprites/bullet-opener.json';
import {
  PLAYER_FRAME,
  PLAYER_PIVOT,
  playerFrame,
  STEPS_PER_ANIMATION_FRAME,
  WALK_CYCLE_LENGTH,
  type SpriteFrame,
} from './playerSprite';
import {
  BOSS_ANCHOR,
  bossFrame,
  CITY_HALL_ANCHOR,
  dancerFrame,
  dancerPoses,
  DISCO_ANCHOR,
  discoFrames,
  ENEMY_ANCHOR,
  enemyFrame,
  FOAM_ANCHOR,
  foamFrame,
  guardFrame,
  MINION_ANCHOR,
  minionFrame,
  officeBossFrame,
  type OfficeBossId,
  OPENER_ANCHOR,
  openerFrame,
  PICKUP_ANCHOR,
  pickupFrame,
  PIJO_ANCHOR,
  pijoFrame,
  PRIMO_ANCHOR,
  primoFrame,
  TRUCK_FRAME,
  type Anchor,
} from './sheets';

/** Las hojas de sprites (la página asocia cada una con su PNG). */
export type SheetId =
  | 'player'
  | 'jacket'
  | 'bottles'
  | 'minion'
  | 'bosses'
  | 'pijo'
  | 'primo'
  | 'truck'
  | 'pickups'
  | 'foam'
  | 'opener'
  | 'cityHall'
  | 'disco';

/** Un frame de la animación y cuántos pasos (1/60 s) se ve. */
export interface AnimationFrame {
  frame: SpriteFrame;
  steps: number;
}

/**
 * Caja de colisión y dónde cae el ancla del dibujo respecto a ella, igual que
 * en el renderer:
 *   feet    centro del borde inferior (personajes de pie, chorro de espuma)
 *   center  centro de la caja (barriles, latas, abrechapas)
 *   top     centro del borde superior (botellas, que caen boca abajo)
 */
export interface Hitbox {
  width: number;
  height: number;
  anchorAt: 'feet' | 'center' | 'top';
}

export interface SpriteAnimation {
  /** Único: sirve de clave en la lista. */
  id: string;
  /** Lo que se ve y se busca, p. ej. "Primo pijo · lanzar barril de madera". */
  name: string;
  /** Una hoja del juego o, en los borradores de imagenes/png/, la URL de la suya. */
  sheet: SheetId | { url: string };
  anchor: Anchor;
  hitbox: Hitbox | null;
  frames: AnimationFrame[];
  /** Avisos y datos para revisar el dibujo (solo los borradores). */
  notes?: string[];
}

/** Las direcciones del jugador, escritas para leerlas ("abajo_derecha" -> "abajo derecha"). */
const directionName = (direction: Direction) => direction.replace('_', ' ');

/** Un dibujo suelto, sin animación (los pasos dan igual: siempre es el mismo). */
const still = (frame: SpriteFrame): AnimationFrame[] => [{ frame, steps: 60 }];

/** `count` frames seguidos de la misma duración, a partir de una función de recorte. */
const sequence = (count: number, steps: number, frameAt: (index: number) => SpriteFrame) =>
  Array.from({ length: count }, (_, index) => ({ frame: frameAt(index), steps }));

/**
 * Animación de lanzar de un jefe, pose a pose: windup y recover duran lo que
 * dicen sus stats, y cada pose se pide a mitad de su tramo (progress) para que
 * caiga en la misma que en el juego.
 */
function throwFrames(
  stats: { windupSteps: number; recoverSteps: number },
  poses: { windup: number; recover: number },
  frameAt: (pose: BossPose) => SpriteFrame,
): AnimationFrame[] {
  const part = (action: 'windup' | 'recover', count: number, steps: number) =>
    sequence(count, steps / count, (index) => frameAt({ action, progress: (index + 0.5) / count }));
  return [
    ...part('windup', poses.windup, stats.windupSteps),
    ...part('recover', poses.recover, stats.recoverSteps),
  ];
}

const walkFrames = (count: number, frameAt: (pose: BossPose) => SpriteFrame) =>
  sequence(count, BOSS_COMMON.walkFrameSteps, (step) => frameAt({ action: 'walk', step }));

const PLAYER_HITBOX: Hitbox = { width: PLAYER.width, height: PLAYER.height, anchorAt: 'feet' };

const bossHitbox = (id: keyof typeof BOSS, anchorAt: Hitbox['anchorAt']): Hitbox => ({
  width: BOSS[id].width,
  height: BOSS[id].height,
  anchorAt,
});

const BOTTLES = [
  { type: 'normal', name: 'normal' },
  { type: 'fast', name: 'rápida' },
  { type: 'heavy', name: 'pesada' },
] as const;

const MINIONS = [
  { type: 'woodBarrel', name: 'de madera' },
  { type: 'ironBarrel', name: 'de hierro' },
] as const;

/** Cuántas poses tiene una fila de la hoja de la gente del ayuntamiento. */
const posesOf = (animation: keyof typeof cityHallMeta.animations) =>
  cityHallMeta.animations[animation].frames;

const DANCE_STEPS = CITY_HALL.danceFrameSteps;

/** Las chicas de la fiesta del nivel 6 y sus acciones. */
const DANCERS = [3, 5, 7] as const;
const DANCER_ACTIONS = [
  { action: 'dance', name: 'bailar' },
  { action: 'scared', name: 'asustarse' },
  { action: 'run', name: 'huir' },
] as const satisfies readonly { action: DancerAction; name: string }[];

/** Pasos que dura cada pose de una chica: el susto se reparte entero entre sus poses. */
function dancerPoseSteps(girl: (typeof DANCERS)[number], action: DancerAction): number {
  if (action === 'scared') return CITY_HALL.dancer.scaredSteps / dancerPoses(girl, action);
  return action === 'run' ? CITY_HALL.dancer.runFrameSteps : DANCE_STEPS;
}

/** Los jefes del despacho del alcalde (nivel 6). */
const OFFICE_BOSSES = [
  { id: 'mayor', name: 'Alcalde (en calzoncillos)', walkPoses: 1 },
  { id: 'blonde', name: 'Chica rubia del despacho', walkPoses: posesOf('office-girl-1') },
  { id: 'redhead', name: 'Chica pelirroja del despacho', walkPoses: posesOf('office-girl-5') },
] as const satisfies readonly { id: OfficeBossId; name: string; walkPoses: number }[];

export const ANIMATIONS: readonly SpriteAnimation[] = [
  ...DIRECTIONS.map((direction) => ({
    id: `player-${direction}`,
    name: `${BRAND.hero} · andar hacia ${directionName(direction)}`,
    sheet: 'player' as const,
    anchor: PLAYER_PIVOT,
    hitbox: PLAYER_HITBOX,
    frames: sequence(WALK_CYCLE_LENGTH, STEPS_PER_ANIMATION_FRAME, (index) =>
      playerFrame(direction, index),
    ),
  })),
  {
    id: 'player-jacket',
    name: `${BRAND.hero} · tapado con la chupa`,
    sheet: 'jacket',
    anchor: PLAYER_PIVOT,
    hitbox: PLAYER_HITBOX,
    frames: still({ sx: 0, sy: 0, ...PLAYER_FRAME }),
  },
  ...BOTTLES.map(({ type, name }) => ({
    id: `bottle-${type}`,
    name: `Botella ${name} · disparar`,
    sheet: 'bottles' as const,
    anchor: ENEMY_ANCHOR,
    hitbox: {
      width: ENEMY_TYPES[type].width,
      height: ENEMY_TYPES[type].height,
      anchorAt: 'top' as const,
    },
    // Cerrada un rato y después la animación de la chapa, como al disparar en el juego
    frames: [
      { frame: enemyFrame(type, 0), steps: 30 },
      ...ENEMY.shootAnimation.map((column) => ({
        frame: enemyFrame(type, column),
        steps: ENEMY.shootFrameSteps,
      })),
    ],
  })),
  ...MINIONS.map(({ type, name }) => ({
    id: `minion-${type}`,
    name: `Barril pequeño ${name}`,
    sheet: 'minion' as const,
    anchor: MINION_ANCHOR,
    hitbox: {
      width: ENEMY_TYPES[type].width,
      height: ENEMY_TYPES[type].height,
      anchorAt: 'center' as const,
    },
    frames: still(minionFrame(type, false)),
  })),
  ...(['wood', 'iron'] as const).map((id) => ({
    id: `boss-${id}`,
    name: `Jefe barril ${id === 'wood' ? 'de madera' : 'de hierro'}`,
    sheet: 'bosses' as const,
    anchor: BOSS_ANCHOR,
    hitbox: bossHitbox(id, 'center'),
    frames: still(bossFrame(id, false)),
  })),
  {
    id: 'pijo-walk',
    name: 'Pijo · andar',
    sheet: 'pijo',
    anchor: PIJO_ANCHOR,
    hitbox: bossHitbox('pijo', 'feet'),
    frames: walkFrames(2, (pose) => pijoFrame(pose, false)),
  },
  {
    id: 'pijo-throw',
    name: 'Pijo · lanzar botella',
    sheet: 'pijo',
    anchor: PIJO_ANCHOR,
    hitbox: bossHitbox('pijo', 'feet'),
    frames: throwFrames(BOSS.pijo, { windup: 1, recover: 1 }, (pose) => pijoFrame(pose, false)),
  },
  {
    id: 'primo-walk',
    name: 'Primo pijo · andar',
    sheet: 'primo',
    anchor: PRIMO_ANCHOR,
    hitbox: bossHitbox('primo', 'feet'),
    frames: walkFrames(4, (pose) => primoFrame(pose, null, false)),
  },
  ...MINIONS.map(({ type, name }) => ({
    id: `primo-throw-${type}`,
    name: `Primo pijo · lanzar barril ${name}`,
    sheet: 'primo' as const,
    anchor: PRIMO_ANCHOR,
    hitbox: bossHitbox('primo', 'feet'),
    frames: throwFrames(BOSS.primo, { windup: 4, recover: 2 }, (pose) =>
      primoFrame(pose, type, false),
    ),
  })),
  ...[1, 2, 3, 4].map((look) => ({
    id: `guard-${look}`,
    name: `Segurata ${look} · bailar`,
    sheet: 'cityHall' as const,
    anchor: CITY_HALL_ANCHOR,
    hitbox: {
      width: ENEMY_TYPES.guard.width,
      height: ENEMY_TYPES.guard.height,
      anchorAt: 'feet' as const,
    },
    frames: sequence(posesOf(`guard-${look}` as 'guard-1'), DANCE_STEPS, (index) =>
      guardFrame(look, index * DANCE_STEPS, false),
    ),
  })),
  ...DANCERS.flatMap((girl) =>
    DANCER_ACTIONS.map(({ action, name }) => ({
      id: `dancer-${girl}-${action}`,
      name: `Chica ${girl} de la fiesta · ${name}`,
      sheet: 'cityHall' as const,
      anchor: CITY_HALL_ANCHOR,
      hitbox: null,
      // La pose de cada momento, pidiéndola a mitad de su tramo, como en el juego
      frames: sequence(dancerPoses(girl, action), dancerPoseSteps(girl, action), (index) =>
        dancerFrame(girl, action, Math.floor((index + 0.5) * dancerPoseSteps(girl, action))),
      ),
    })),
  ),
  ...OFFICE_BOSSES.flatMap(({ id, name, walkPoses }) => [
    {
      id: `${id}-walk`,
      name: `${name} · bailar`,
      sheet: 'cityHall' as const,
      anchor: CITY_HALL_ANCHOR,
      hitbox: bossHitbox(id, 'feet'),
      frames: walkFrames(walkPoses, (pose) => officeBossFrame(id, pose, false)),
    },
    {
      id: `${id}-throw`,
      name: `${name} · lanzar botella`,
      sheet: 'cityHall' as const,
      anchor: CITY_HALL_ANCHOR,
      hitbox: bossHitbox(id, 'feet'),
      frames: throwFrames(BOSS[id], { windup: 1, recover: 1 }, (pose) =>
        officeBossFrame(id, pose, false),
      ),
    },
  ]),
  ...(['ball', 'sparkles'] as const).map((part) => ({
    id: `disco-${part}`,
    name: part === 'ball' ? 'Bola de discoteca · girar' : 'Brillos de la bola de discoteca',
    sheet: 'disco' as const,
    anchor: DISCO_ANCHOR,
    hitbox: null,
    frames: sequence(
      4,
      CITY_HALL.discoFrameSteps,
      (index) => discoFrames(index * CITY_HALL.discoFrameSteps)[part],
    ),
  })),
  {
    id: 'foam',
    name: 'Chorro de espuma',
    sheet: 'foam',
    anchor: FOAM_ANCHOR,
    hitbox: { width: ENEMY_BULLET.width, height: ENEMY_BULLET.height, anchorAt: 'feet' },
    // Todos los frames en orden: los cortos del principio (al nacer) y los del bucle
    frames: sequence(foamMeta.frames, ENEMY_BULLET.frameSteps, (index) =>
      foamFrame(index * ENEMY_BULLET.frameSteps, ENEMY_BULLET.frameSteps),
    ),
  },
  {
    id: 'opener',
    name: 'Abrechapas en llamas',
    sheet: 'opener',
    anchor: OPENER_ANCHOR,
    hitbox: { width: PLAYER_BULLET.width, height: PLAYER_BULLET.height, anchorAt: 'center' },
    frames: sequence(openerMeta.frames, PLAYER_BULLET.frameSteps, (index) =>
      openerFrame(index * PLAYER_BULLET.frameSteps, PLAYER_BULLET.frameSteps),
    ),
  },
  ...(['health', 'speed'] as const).map((type) => ({
    id: `pickup-${type}`,
    name: `Lata ${type === 'health' ? 'de vida' : 'de velocidad'}`,
    sheet: 'pickups' as const,
    anchor: PICKUP_ANCHOR,
    hitbox: { width: PICKUP.width, height: PICKUP.height, anchorAt: 'center' as const },
    frames: still(pickupFrame(type)),
  })),
  {
    id: 'truck',
    name: 'Camión del nivel 5',
    sheet: 'truck',
    anchor: { x: 0, y: 0 },
    hitbox: null,
    frames: still(TRUCK_FRAME),
  },
];

/** Pasos que dura una vuelta entera de la animación. */
export function animationLength(animation: SpriteAnimation): number {
  return animation.frames.reduce((sum, { steps }) => sum + steps, 0);
}

/** Qué frame se ve cuando han pasado `steps` pasos (en bucle). */
export function frameIndexAt(animation: SpriteAnimation, steps: number): number {
  const length = animationLength(animation);
  let left = ((steps % length) + length) % length;
  for (const [index, { steps: duration }] of animation.frames.entries()) {
    if (left < duration) return index;
    left -= duration;
  }
  return animation.frames.length - 1;
}

/** Paso en el que empieza el frame `index`: para saltar a él con los botones ‹ ›. */
export function frameStart(animation: SpriteAnimation, index: number): number {
  return animation.frames.slice(0, index).reduce((sum, { steps }) => sum + steps, 0);
}

/** Minúsculas y sin tildes, para que "camion" encuentre "Camión". */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Las animaciones cuyo nombre contiene TODAS las palabras buscadas, en
 * cualquier orden ("primo hierro" encuentra "Primo pijo · lanzar barril de hierro").
 */
export function searchAnimations(
  animations: readonly SpriteAnimation[],
  query: string,
): SpriteAnimation[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return animations.filter((animation) => {
    const name = normalize(animation.name);
    return words.every((word) => name.includes(word));
  });
}
