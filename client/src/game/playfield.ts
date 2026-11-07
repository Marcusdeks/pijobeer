/**
 * ZONA JUGABLE: la franja de suelo entre las dos paredes del callejón (y, en
 * las calles con final, la puerta por la que se sale).
 *
 * Nadie puede salir de ella: el jugador no se sube a las paredes, las
 * botellas aparecen dentro y los jefes se mueven de pared a pared.
 *
 * Los límites salen de assets/sprites/alleys.json, que genera "npm run
 * sprites" a partir de dónde están las paredes en el dibujo. Así, si cambia
 * el arte de un callejón, los límites cambian con él. Dentro del ayuntamiento
 * (nivel 6) no hay callejón: el suelo es el de cada sala (CITY_HALL en config.ts).
 */
import type { AlleyId, LevelDefinition } from '@pijobeer/shared';
import alleysMeta from '../assets/sprites/alleys.json';
import { CITY_HALL } from './config';
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
  end?: { top: number; doorTop: number; door: Point };
}

/** Los datos del callejón de un nivel (los genera el script de sprites). */
export function alleyMeta(alley: AlleyId): AlleyMeta {
  return (alleysMeta.alleys as Record<string, AlleyMeta>)[String(alley)]!;
}

/** El suelo con el que empieza el nivel: el de su callejón o, dentro del ayuntamiento, el de la planta baja. */
export function playfieldFor(level: LevelDefinition): Playfield {
  if (level.alley === null) return CITY_HALL.hall.field;
  const alley = alleyMeta(level.alley);
  return { left: alley.floorLeft, right: alley.floorRight };
}

/** Final de una calle con final: por dónde se sale al vencer (ver exitFor). */
export interface Exit {
  /** La puerta, en píxeles de pantalla con la calle parada (queda por encima de la vista). */
  door: Point;
  /** Cuánto sube la cámara, al vencer, para que se vea la puerta. */
  reveal: number;
}

/** Por dónde sale el protagonista al acabar. null si el callejón no tiene final. */
export function exitFor(level: LevelDefinition): Exit | null {
  if (level.alley === null) return null;
  const { end } = alleyMeta(level.alley);
  if (!end) return null;
  return { door: { x: end.door.x, y: end.door.y - end.top }, reveal: end.top - end.doorTop };
}
