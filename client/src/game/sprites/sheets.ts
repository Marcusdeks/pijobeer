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
import type { BossId, EnemyTypeId } from '@pijobeer/shared';
import { ENEMY_TYPES } from '../config';
import alleysMeta from '../../assets/sprites/alleys.json';
import bossMeta from '../../assets/sprites/bosses.json';
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
  return gridFrame(enemyMeta, enemyMeta.variants.indexOf(ENEMY_TYPES[type].variant), frame);
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
//  Jefes finales (una columna por jefe; fila 0 normal, fila 1 destello blanco)
// ------------------------------------------------------------------

/** Centro del barril dentro del frame. */
export const BOSS_ANCHOR: Anchor = bossMeta.anchor;

export function bossFrame(id: BossId, flashing: boolean): SpriteFrame {
  const column = bossMeta.bosses.indexOf(id);
  return {
    sx: column * bossMeta.frameWidth,
    sy: flashing ? bossMeta.frameHeight : 0,
    width: bossMeta.frameWidth,
    height: bossMeta.frameHeight,
  };
}

// ------------------------------------------------------------------
//  Callejones
// ------------------------------------------------------------------

/** Escala a la que se dibujan las hojas de los callejones (están a mitad de tamaño). */
export const ALLEY_DRAW_SCALE = alleysMeta.drawScale;

/** Alto (en píxeles de la hoja) del callejón de un nivel: lo que tarda en repetirse. */
export function alleyHeight(alley: number): number {
  return alleysMeta.alleys[String(alley) as keyof typeof alleysMeta.alleys].height;
}
