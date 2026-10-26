/**
 * TEXTOS DE HISTORIA que paran la partida: cuáles hay y cuándo salen.
 *
 * El motor solo sabe parar en ciertos momentos (DialogMoment: al empezar,
 * antes de los jefes). Qué texto toca en cada momento de cada nivel se
 * decide aquí, en un único sitio, y PlayPage lo enseña con StoryOverlay.
 *
 *   lines       claves de traducción, una por párrafo (las dice cada personaje)
 *   durationMs  cuánto se queda en pantalla antes de seguir solo
 *   skippable   si tiene botón para saltarlo
 */
import type { DialogMoment } from '../../game/GameSession';

export type StoryId = 'jacketTutorial' | 'level4Opening' | 'pijosIntro';

type StoryLineKey =
  | 'play.story.jacketTutorial'
  | 'play.story.level4Opening'
  | 'play.story.pijosHero'
  | 'play.story.pijosReply'
  | 'play.story.pijosHint';

export interface Story {
  lines: readonly StoryLineKey[];
  durationMs: number;
  skippable: boolean;
}

export const STORIES: Record<StoryId, Story> = {
  /** Cómo usar la chupa. Sin botón: el juego se para unos segundos para leerlo y sigue solo. */
  jacketTutorial: { lines: ['play.story.jacketTutorial'], durationMs: 7000, skippable: false },
  level4Opening: { lines: ['play.story.level4Opening'], durationMs: 6000, skippable: true },
  pijosIntro: {
    lines: ['play.story.pijosHero', 'play.story.pijosReply', 'play.story.pijosHint'],
    durationMs: 14000,
    skippable: true,
  },
};

/** Nivel en el que se aprende a usar la chupa (el primero en que se puede). */
const JACKET_TUTORIAL_LEVEL = 3;
const PIJOS_LEVEL = 4;

/**
 * Textos de una partida, por momento.
 * @param jacketTutorialSeen - si ya se ha visto el aviso de la chupa (solo sale una vez)
 */
export function storiesFor(
  levelId: number,
  jacketTutorialSeen: boolean,
): Partial<Record<DialogMoment, StoryId>> {
  if (levelId === JACKET_TUTORIAL_LEVEL && !jacketTutorialSeen) {
    return { beforeBosses: 'jacketTutorial' };
  }
  // El nivel 4 los enseña siempre, con botón para saltarlos
  if (levelId === PIJOS_LEVEL) return { opening: 'level4Opening', beforeBosses: 'pijosIntro' };
  return {};
}
