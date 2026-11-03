/**
 * Tests del recorte de las hojas de enemigos, jefes animados, balas y latas.
 */
import { describe, expect, it } from 'vitest';
import enemyMeta from '../../assets/sprites/enemy-bottles.json';
import foamMeta from '../../assets/sprites/bullet-foam.json';
import openerMeta from '../../assets/sprites/bullet-opener.json';
import minionMeta from '../../assets/sprites/barrel-minion.json';
import pickupMeta from '../../assets/sprites/pickups.json';
import primoMeta from '../../assets/sprites/primo.json';
import {
  enemyFrame,
  foamFrame,
  minionFrame,
  openerFrame,
  pickupFrame,
  pijoFrame,
  primoFrame,
} from './sheets';

/** Columna de la hoja a la que corresponde un recorte. */
const column = (sx: number, frameWidth: number) => sx / frameWidth;

describe('enemyFrame', () => {
  it('cada color es una fila y cada frame una columna', () => {
    expect(enemyFrame('heavy', 3)).toEqual({
      sx: 3 * enemyMeta.frameWidth,
      sy: 2 * enemyMeta.frameHeight,
      width: enemyMeta.frameWidth,
      height: enemyMeta.frameHeight,
    });
  });
});

describe('minionFrame', () => {
  it('el de madera y el de hierro son columnas; el destello, la fila de abajo', () => {
    expect(minionFrame('barrel', false).sx).toBe(0);
    expect(minionFrame('woodBarrel', false).sx).toBe(0);
    expect(minionFrame('ironBarrel', true)).toEqual({
      sx: minionMeta.frameWidth,
      sy: minionMeta.frameHeight,
      width: minionMeta.frameWidth,
      height: minionMeta.frameHeight,
    });
  });
});

describe('pijoFrame', () => {
  it('alterna sus dos pasos al andar y tiene una pose para coger impulso y otra para lanzar', () => {
    const columns = [
      pijoFrame({ action: 'walk', step: 0 }, false),
      pijoFrame({ action: 'walk', step: 3 }, false),
      pijoFrame({ action: 'windup', progress: 0.5 }, false),
      pijoFrame({ action: 'recover', progress: 0.5 }, false),
    ].map((frame) => column(frame.sx, frame.width));
    expect(columns).toEqual([0, 1, 2, 3]);
  });
});

describe('primoFrame', () => {
  const at = (frame: { sx: number; sy: number }) => [
    frame.sy / primoMeta.frameHeight,
    frame.sx / primoMeta.frameWidth,
  ];

  it('anda con sus cuatro pasos en la primera fila', () => {
    const steps = [0, 1, 2, 3, 4].map((step) =>
      at(primoFrame({ action: 'walk', step }, null, false)),
    );
    expect(steps).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 0],
    ]);
  });

  it('al lanzar recorre sus seis poses, en la fila del barril que lleva', () => {
    const poses = [
      primoFrame({ action: 'windup', progress: 0 }, 'woodBarrel', false),
      primoFrame({ action: 'windup', progress: 0.99 }, 'woodBarrel', false),
      primoFrame({ action: 'recover', progress: 0 }, 'ironBarrel', false),
      primoFrame({ action: 'recover', progress: 0.99 }, 'ironBarrel', false),
    ].map(at);
    expect(poses).toEqual([
      [1, 0],
      [1, 3],
      [2, 4],
      [2, 5],
    ]);
  });

  it('el destello está en las filas de debajo, en el mismo orden', () => {
    const [row] = at(primoFrame({ action: 'windup', progress: 0 }, 'ironBarrel', true));
    expect(row).toBe(2 + primoMeta.rows);
  });
});

describe('foamFrame', () => {
  it('reproduce los frames cortos una vez y después repite los largos en bucle', () => {
    const steps = 5;
    const columns = Array.from({ length: 10 }, (_, i) =>
      column(foamFrame(i * steps, steps).sx, foamMeta.frameWidth),
    );
    expect(columns).toEqual([0, 1, 2, 3, 4, 2, 3, 4, 2, 3]);
  });
});

describe('openerFrame', () => {
  it('repite los frames de las llamas en bucle', () => {
    const steps = 5;
    const columns = Array.from({ length: 6 }, (_, i) =>
      column(openerFrame(i * steps, steps).sx, openerMeta.frameWidth),
    );
    expect(columns).toEqual([0, 1, 2, 3, 0, 1]);
  });
});

describe('pickupFrame', () => {
  it('cada lata es una columna de la única fila', () => {
    expect(pickupFrame('speed')).toEqual({
      sx: pickupMeta.pickups.indexOf('speed') * pickupMeta.frameWidth,
      sy: 0,
      width: pickupMeta.frameWidth,
      height: pickupMeta.frameHeight,
    });
  });
});
