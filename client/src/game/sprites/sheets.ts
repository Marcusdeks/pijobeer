/**
 * HOJAS DE SPRITES de enemigos y balas: qué trozo de cada imagen se dibuja.
 *
 * Los metadatos (tamaño de frame, número de frames, punto de anclaje) los
 * genera "npm run sprites" junto a cada PNG, así que el juego y las imágenes
 * no pueden desincronizarse: si cambia el arte, cambian los dos a la vez.
 *
 * Igual que playerSprite.ts, este módulo solo tiene DATOS y cálculos; las
 * imágenes las carga GameCanvas. Así la lógica se testea sin navegador.
 */
import type { BossId, EnemyTypeId, LevelDefinition } from '@pijobeer/shared';
import { ENEMY_TYPES, type PickupTypeId } from '../config';
import type { BossPose } from '../entities/Boss';
import { alleyMeta } from '../playfield';
import alleysMeta from '../../assets/sprites/alleys.json';
import minionMeta from '../../assets/sprites/barrel-minion.json';
import bossMeta from '../../assets/sprites/bosses.json';
import pijoMeta from '../../assets/sprites/pijo.json';
import primoMeta from '../../assets/sprites/primo.json';
import truckMeta from '../../assets/sprites/truck.json';
import pickupMeta from '../../assets/sprites/pickups.json';
import enemyMeta from '../../assets/sprites/enemy-bottles.json';
import foamMeta from '../../assets/sprites/bullet-foam.json';
import openerMeta from '../../assets/sprites/bullet-opener.json';
import type { SpriteFrame } from './playerSprite';

/** Punto de un frame que se hace coincidir con un punto concreto de la caja de colisión. */
export interface Anchor {
  x: number;
  y: number;
}

/**
 * Hoja de rejilla: frame `column` de la fila `row`.
 * El módulo protege de índices fuera de rango.
 */
function gridFrame(
  meta: { frameWidth: number; frameHeight: number; frames: number },
  row: number,
  column: number,
): SpriteFrame {
  const col = ((column % meta.frames) + meta.frames) % meta.frames;
  return {
    sx: col * meta.frameWidth,
    sy: row * meta.frameHeight,
    width: meta.frameWidth,
    height: meta.frameHeight,
  };
}

// ------------------------------------------------------------------
//  Botellas (una fila por color, una columna por frame)
// ------------------------------------------------------------------

/** Base de la botella dentro del frame (arriba del todo: la botella está boca abajo). */
export const ENEMY_ANCHOR: Anchor = enemyMeta.anchor;

/** Cada tipo de botella se dibuja con su color (ver ENEMY_TYPES en config.ts). */
export function enemyFrame(type: EnemyTypeId, frame: number): SpriteFrame {
  const row = Math.max(0, enemyMeta.variants.indexOf(ENEMY_TYPES[type].variant));
  return gridFrame(enemyMeta, row, frame);
}

// ------------------------------------------------------------------
//  Barriles pequeños (una columna por barril; fila 0 normal, fila 1 destello blanco)
// ------------------------------------------------------------------

/** Centro del barril dentro del frame. */
export const MINION_ANCHOR: Anchor = minionMeta.anchor;

/** El barril de un tipo de enemigo (su variant: madera o hierro). */
export function minionFrame(type: EnemyTypeId, flashing: boolean): SpriteFrame {
  const column = Math.max(0, minionMeta.barrels.indexOf(ENEMY_TYPES[type].variant));
  const frames = minionMeta.barrels.length;
  return gridFrame({ ...minionMeta, frames }, flashing ? 1 : 0, column);
}

// ------------------------------------------------------------------
//  Chorro de espuma (bala enemiga)
// ------------------------------------------------------------------

/** Cabeza del chorro dentro del frame (abajo: es lo que impacta). */
export const FOAM_ANCHOR: Anchor = foamMeta.anchor;

/**
 * Frame del chorro según los pasos que lleva en vuelo.
 * Los primeros frames (cortos) se ven UNA vez, mientras el chorro "nace";
 * después se repiten en bucle los largos.
 */
export function foamFrame(age: number, frameSteps: number): SpriteFrame {
  const index = Math.floor(age / frameSteps);
  const { introFrames, frames } = foamMeta;
  const frame =
    index < introFrames ? index : introFrames + ((index - introFrames) % (frames - introFrames));
  return gridFrame(foamMeta, 0, frame);
}

// ------------------------------------------------------------------
//  Abrechapas en llamas (bala del jugador)
// ------------------------------------------------------------------

/** Centro del aro metálico dentro del frame. */
export const OPENER_ANCHOR: Anchor = openerMeta.anchor;

/** Frame de las llamas según los pasos en vuelo (en bucle). */
export function openerFrame(age: number, frameSteps: number): SpriteFrame {
  return gridFrame(openerMeta, 0, Math.floor(age / frameSteps));
}

// ------------------------------------------------------------------
//  Barriles jefe (una columna por jefe; fila 0 normal, fila 1 destello blanco)
// ------------------------------------------------------------------

/** Centro del barril dentro del frame. */
export const BOSS_ANCHOR: Anchor = bossMeta.anchor;

export function bossFrame(id: Exclude<BossId, 'pijo' | 'primo'>, flashing: boolean): SpriteFrame {
  const column = bossMeta.bosses.indexOf(id);
  return {
    sx: column * bossMeta.frameWidth,
    sy: flashing ? bossMeta.frameHeight : 0,
    width: bossMeta.frameWidth,
    height: bossMeta.frameHeight,
  };
}

// ------------------------------------------------------------------
//  Pijo (una columna por pose; fila 0 normal, fila 1 destello blanco)
// ------------------------------------------------------------------

/** Los pies del pijo dentro del frame (se apoyan en la base de su caja, como el jugador). */
export const PIJO_ANCHOR: Anchor = pijoMeta.anchor;

/**
 * Columnas de la hoja (ver PIJO en scripts/sprites/bosses.mjs): 0 y 1 los dos
 * pasos al andar, 2 el brazo arriba con la botella (cogiendo impulso) y 3 el
 * brazo estirado (recién lanzada).
 */
export function pijoFrame(pose: BossPose, flashing: boolean): SpriteFrame {
  const column = pose.action === 'walk' ? pose.step % 2 : pose.action === 'windup' ? 2 : 3;
  return gridFrame(pijoMeta, flashing ? 1 : 0, column);
}

// ------------------------------------------------------------------
//  Primo pijo (una fila por animación y una columna por pose; debajo, el destello)
// ------------------------------------------------------------------

/** Los pies del primo dentro del frame (como el pijo). */
export const PRIMO_ANCHOR: Anchor = primoMeta.anchor;

/** Poses de cada parte de la animación de lanzar (ver PRIMO en scripts/sprites/bosses.mjs). */
const PRIMO_WALK_POSES = 4;
const PRIMO_WINDUP_POSES = 4; // agacharse, levantarlo, sobre la cabeza, a punto
const PRIMO_RECOVER_POSES = 2; // soltándolo, con las manos vacías

/**
 * Fila 0: andar. Filas 1 y 2: lanzar un barril de madera o de hierro (el que
 * tenga en las manos). Cada momento de la animación (progress) cae en su pose.
 */
export function primoFrame(
  pose: BossPose,
  held: EnemyTypeId | null,
  flashing: boolean,
): SpriteFrame {
  const pick = (progress: number, poses: number) =>
    Math.min(poses - 1, Math.floor(progress * poses));
  const row = pose.action === 'walk' ? 0 : held === 'ironBarrel' ? 2 : 1;
  const column =
    pose.action === 'walk'
      ? pose.step % PRIMO_WALK_POSES
      : pose.action === 'windup'
        ? pick(pose.progress, PRIMO_WINDUP_POSES)
        : PRIMO_WINDUP_POSES + pick(pose.progress, PRIMO_RECOVER_POSES);
  const frames = PRIMO_WINDUP_POSES + PRIMO_RECOVER_POSES;
  return gridFrame({ ...primoMeta, frames }, row + (flashing ? primoMeta.rows : 0), column);
}

// ------------------------------------------------------------------
//  Camión del final del nivel 5 (un solo dibujo)
// ------------------------------------------------------------------

export const TRUCK_FRAME: SpriteFrame = {
  sx: 0,
  sy: 0,
  width: truckMeta.width,
  height: truckMeta.height,
};

// ------------------------------------------------------------------
//  Latas (una fila, una columna por tipo)
// ------------------------------------------------------------------

/** Centro de la lata dentro del frame. */
export const PICKUP_ANCHOR: Anchor = pickupMeta.anchor;

export function pickupFrame(type: PickupTypeId): SpriteFrame {
  return {
    sx: pickupMeta.pickups.indexOf(type) * pickupMeta.frameWidth,
    sy: 0,
    width: pickupMeta.frameWidth,
    height: pickupMeta.frameHeight,
  };
}

// ------------------------------------------------------------------
//  Callejones
// ------------------------------------------------------------------

/** Escala a la que se dibujan las hojas de los callejones (están a mitad de tamaño). */
export const ALLEY_DRAW_SCALE = alleysMeta.drawScale;

/**
 * Cómo se reparte la hoja de un callejón, en píxeles de la hoja:
 *   head  lo de arriba, que no se repite (el final de las calles que lo tienen; si no, 0)
 *   loop  lo que se repite en bucle, que va debajo
 */
export function alleyLayout(alley: LevelDefinition['alley']): { head: number; loop: number } {
  const { height, loopTop = 0 } = alleyMeta(alley);
  return { head: loopTop, loop: height - loopTop };
}
