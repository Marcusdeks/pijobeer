/**
 * Tests de qué textos de historia salen en cada partida.
 */
import { describe, expect, it } from 'vitest';
import { storiesFor } from './story';

describe('textos de historia', () => {
  it('el aviso de la chupa sale antes del jefe del nivel 3, solo la primera vez', () => {
    expect(storiesFor(3, false)).toEqual({ beforeBosses: 'jacketTutorial' });
    expect(storiesFor(3, true)).toEqual({});
  });

  it('el nivel 4 siempre tiene su texto al empezar y el de los pijos', () => {
    const expected = { opening: 'level4Opening', beforeBosses: 'pijosIntro' };
    expect(storiesFor(4, false)).toEqual(expected);
    expect(storiesFor(4, true)).toEqual(expected);
  });

  it('los niveles 1 y 2 no tienen textos', () => {
    expect(storiesFor(1, false)).toEqual({});
    expect(storiesFor(2, false)).toEqual({});
  });
});
