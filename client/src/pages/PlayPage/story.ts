/**
 * TEXTOS DE HISTORIA que paran la partida: cuáles hay y cuándo salen.
 *
 * El motor solo sabe parar en ciertos momentos (DialogMoment: al empezar,
 * antes y después de los jefes). Qué texto toca en cada momento de cada nivel
 * se decide aquí, en un único sitio, y PlayPage lo enseña con StoryOverlay.
 *
 *   lines       claves de traducción, una por párrafo (las dice cada personaje)
 *   durationMs  cuánto se queda en pantalla antes de seguir solo
 *   skippable   si tiene botón para saltarlo
 */
import { FIRST_JACKET_LEVEL } from '@pijobeer/shared';
import type { DialogMoment } from '../../game/GameSession';

export type StoryId =
  | 'jacketTutorial'
  | 'level4Opening'
  | 'pijosIntro'
  | 'pijosDefeated'
  | 'level5Opening'
  | 'primoIntro'
  | 'primoDefeated'
  | 'level6Opening'
  | 'mayorIntro'
  | 'mayorDefeated'
  | 'level6Epilogue';

type StoryLineKey =
  | 'play.story.jacketTutorial'
  | 'play.story.level4Opening'
  | 'play.story.pijosHero'
  | 'play.story.pijosReply'
  | 'play.story.pijosHint'
  | 'play.story.pijosDefeatedHero'
  | 'play.story.pijosDefeatedReply'
  | 'play.story.level5Opening'
  | 'play.story.primoIntro'
  | 'play.story.primoDefeated'
  | 'play.story.level6Opening'
  | 'play.story.mayorIntro'
  | 'play.story.mayorDefeated'
  | 'play.story.level6Epilogue';

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
  /** Al derrotar a los pijos: anuncian al que viene después. */
  pijosDefeated: {
    lines: ['play.story.pijosDefeatedHero', 'play.story.pijosDefeatedReply'],
    durationMs: 10000,
    skippable: true,
  },
  level5Opening: { lines: ['play.story.level5Opening'], durationMs: 9000, skippable: true },
  primoIntro: { lines: ['play.story.primoIntro'], durationMs: 6000, skippable: true },
  /** Al derrotar al primo: después, el protagonista entra solo en el ayuntamiento. */
  primoDefeated: { lines: ['play.story.primoDefeated'], durationMs: 12000, skippable: true },
  level6Opening: { lines: ['play.story.level6Opening'], durationMs: 6000, skippable: true },
  /** Al llegar al despacho del alcalde, antes de la lucha. */
  mayorIntro: { lines: ['play.story.mayorIntro'], durationMs: 6000, skippable: true },
  mayorDefeated: { lines: ['play.story.mayorDefeated'], durationMs: 7000, skippable: true },
  /** De vuelta en la planta baja, ya sin fiesta: lo último antes de la victoria. */
  level6Epilogue: { lines: ['play.story.level6Epilogue'], durationMs: 7000, skippable: true },
};

/** Los niveles con historia propia la enseñan siempre, con botón para saltarla. */
const LEVEL_STORIES: Readonly<Record<number, Partial<Record<DialogMoment, StoryId>>>> = {
  4: { opening: 'level4Opening', beforeBosses: 'pijosIntro', afterBosses: 'pijosDefeated' },
  5: { opening: 'level5Opening', beforeBosses: 'primoIntro', afterBosses: 'primoDefeated' },
  6: {
    opening: 'level6Opening',
    beforeBosses: 'mayorIntro',
    afterBosses: 'mayorDefeated',
    epilogue: 'level6Epilogue',
  },
};

/**
 * Textos de una partida, por momento.
 * @param jacketTutorialSeen - si ya se ha visto el aviso de la chupa (solo sale una vez)
 */
export function storiesFor(
  levelId: number,
  jacketTutorialSeen: boolean,
): Partial<Record<DialogMoment, StoryId>> {
  if (levelId === FIRST_JACKET_LEVEL && !jacketTutorialSeen) {
    return { beforeBosses: 'jacketTutorial' };
  }
  return LEVEL_STORIES[levelId] ?? {};
}
