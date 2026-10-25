/**
 * Tests del recorte de las hojas de enemigos y balas.
 */
import { describe, expect, it } from 'vitest';
import enemyMeta from '../../assets/sprites/enemy-bottles.json';
import foamMeta from '../../assets/sprites/bullet-foam.json';
import openerMeta from '../../assets/sprites/bullet-opener.json';
import { enemyFrame, foamFrame, openerFrame } from './sheets';

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
