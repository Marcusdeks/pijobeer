/**
 * Tests de la animación del jugador: dirección, ciclo de andar y recorte de la hoja.
 */
import { describe, expect, it } from 'vitest';
import meta from '../../assets/sprites/player.json';
import type { GameAction } from '../config';
import { DIRECTIONS, directionFromInput } from '../direction';
import { Player } from '../entities/Player';
import type { InputState } from '../input/InputState';
import { IDLE_FRAME, playerFrame, STEPS_PER_ANIMATION_FRAME } from './playerSprite';

function fakeInput(...actions: GameAction[]): InputState {
  return { isDown: (action) => actions.includes(action) };
}

/** Avanza al jugador `steps` pasos con las teclas indicadas. */
function walk(player: Player, steps: number, ...actions: GameAction[]) {
  for (let i = 0; i < steps; i++) player.update(fakeInput(...actions));
}

describe('directionFromInput', () => {
  it.each([
    [0, -1, 'arriba'],
    [1, -1, 'arriba_derecha'],
    [1, 0, 'derecha'],
    [1, 1, 'abajo_derecha'],
    [0, 1, 'abajo'],
    [-1, 1, 'abajo_izquierda'],
    [-1, 0, 'izquierda'],
    [-1, -1, 'arriba_izquierda'],
  ] as const)('(%i, %i) -> %s', (dx, dy, expected) => {
    expect(directionFromInput(dx, dy)).toBe(expected);
  });

  it('sin movimiento devuelve null', () => {
    expect(directionFromInput(0, 0)).toBeNull();
  });
});

describe('animación del jugador', () => {
  it('mira hacia donde se mueve, también en diagonal', () => {
    const player = Player.spawn();
    walk(player, 1, 'up', 'left');
    expect(player.facing).toBe('arriba_izquierda');
    walk(player, 1, 'down', 'right');
    expect(player.facing).toBe('abajo_derecha');
  });

  it('al pararse conserva la dirección y vuelve a la pose neutra', () => {
    const player = Player.spawn();
    walk(player, 30, 'left');
    walk(player, 1);
    expect(player.facing).toBe('izquierda');
    expect(player.isMoving).toBe(false);
    expect(player.animationFrame).toBe(IDLE_FRAME);
  });

  it('pulsar dos teclas opuestas a la vez no mueve ni anima', () => {
    const player = Player.spawn();
    const { x } = player;
    walk(player, 10, 'left', 'right');
    expect(player.x).toBe(x);
    expect(player.isMoving).toBe(false);
  });

  it('recorre el ciclo neutro -> paso 1 -> neutro -> paso 2 en bucle, al ritmo del JSON', () => {
    const player = Player.spawn();
    const framesSeen: number[] = [];

    // Dos ciclos completos, apuntando cada cambio de frame
    const twoCycles = Math.floor(STEPS_PER_ANIMATION_FRAME * meta.columns * 2);
    for (let i = 0; i < twoCycles; i++) {
      player.update(fakeInput('right'));
      if (framesSeen.at(-1) !== player.animationFrame) framesSeen.push(player.animationFrame);
    }

    expect(framesSeen).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });
});

describe('playerFrame (recorte de la hoja)', () => {
  it('cada dirección usa su fila de player.json', () => {
    for (const direction of DIRECTIONS) {
      expect(playerFrame(direction, 0).sy).toBe(meta.filas[direction] * meta.frame_height);
    }
  });

  it('cada frame del ciclo usa su columna y el tamaño del JSON', () => {
    expect(playerFrame('abajo', 3)).toEqual({
      sx: 3 * meta.frame_width,
      sy: meta.filas.abajo * meta.frame_height,
      width: meta.frame_width,
      height: meta.frame_height,
    });
  });
});
