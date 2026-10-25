/**
 * Utilidades compartidas por los tests del motor (no se usan en el juego).
 */
import type { GameAction } from './config';
import type { GameSession } from './GameSession';
import type { InputState } from './input/InputState';

/** Entrada falsa: "pulsa" las acciones que se le digan. */
export function fakeInput(...actions: GameAction[]): InputState {
  return { isDown: (action) => actions.includes(action) };
}

export const noInput = fakeInput();

/** Aleatorio fijo: siempre el mismo resultado, para tests predecibles. */
export const fixedRandom = () => 0.5;

/** Avanza una partida `steps` pasos. */
export function run(session: GameSession, steps: number, input = noInput): void {
  for (let i = 0; i < steps; i++) session.step(input);
}
