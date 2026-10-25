/**
 * ZONA JUGABLE: la franja de suelo entre las dos paredes del callejón.
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

/** Límites horizontales del suelo, en píxeles del área de juego. */
export interface Playfield {
  left: number;
  right: number;
}

type AlleyKey = keyof typeof alleysMeta.alleys;

export function playfieldFor(level: LevelDefinition): Playfield {
  const alley = alleysMeta.alleys[String(level.alley) as AlleyKey];
  return { left: alley.floorLeft, right: alley.floorRight };
}
