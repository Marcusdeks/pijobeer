/**
 * ZONA JUGABLE: la franja de suelo entre las dos paredes del callejón (y, en
 * las calles con final, la puerta por la que se sale).
 *
 * Nadie puede salir de ella: el jugador no se sube a las paredes, las
 * botellas aparecen dentro y los jefes se mueven de pared a pared.
 *
 * Los límites salen de assets/sprites/alleys.json, que genera "npm run
 * sprites" a partir de dónde están las paredes en el dibujo. Así, si cambia
 * el arte de un callejón, los límites cambian con él.
 */
import type { LevelDefinition } from '@pijobeer/shared';
import alleysMeta from '../assets/sprites/alleys.json';
import type { Point } from './geometry';

/** Límites horizontales del suelo, en píxeles del área de juego. */
export interface Playfield {
  left: number;
  right: number;
}

/** Datos de un callejón. Los de las calles con final traen además `loopTop` y `end`. */
export interface AlleyMeta {
  height: number;
  floorLeft: number;
  floorRight: number;
  loopTop?: number;
  end?: { top: number; door: Point };
}

/** Los datos del callejón de un nivel (los genera el script de sprites). */
export function alleyMeta(alley: LevelDefinition['alley']): AlleyMeta {
  return (alleysMeta.alleys as Record<string, AlleyMeta>)[String(alley)]!;
}

export function playfieldFor(level: LevelDefinition): Playfield {
  const alley = alleyMeta(level.alley);
  return { left: alley.floorLeft, right: alley.floorRight };
}

/**
 * Puerta por la que entra el protagonista al acabar, en píxeles de pantalla
 * con el final de la calle a la vista. null si el callejón no tiene final.
 */
export function exitFor(level: LevelDefinition): Point | null {
  const { end } = alleyMeta(level.alley);
  return end ? { x: end.door.x, y: end.door.y - end.top } : null;
}
