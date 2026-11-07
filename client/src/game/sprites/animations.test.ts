/**
 * Tests del catálogo de animaciones de la página de prueba del admin.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANIMATIONS,
  animationLength,
  frameIndexAt,
  frameStart,
  searchAnimations,
  type SheetId,
  type SpriteAnimation,
} from './animations';

/** PNG de cada hoja (los mismos que importa la página). */
const SHEET_FILES: Record<SheetId, string> = {
  player: 'player.png',
  jacket: 'player-jacket.png',
  bottles: 'enemy-bottles.png',
  minion: 'barrel-minion.png',
  bosses: 'bosses.png',
  pijo: 'pijo.png',
  primo: 'primo.png',
  truck: 'truck.png',
  pickups: 'pickups.png',
  foam: 'bullet-foam.png',
  opener: 'bullet-opener.png',
  cityHall: 'city-hall.png',
  disco: 'disco.png',
};

/** Ancho y alto de un PNG, leídos de su cabecera (bytes 16 a 23 del bloque IHDR). */
function pngSize(file: string): { width: number; height: number } {
  const data = readFileSync(new URL(`../../assets/sprites/${file}`, import.meta.url));
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe('ANIMATIONS', () => {
  it('cada animación tiene un id único', () => {
    const ids = ANIMATIONS.map((animation) => animation.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada frame es un recorte que cae dentro de su hoja', () => {
    for (const animation of ANIMATIONS) {
      // Las del juego usan sus hojas; las de URL son solo de los borradores
      if (typeof animation.sheet !== 'string') throw new Error(`${animation.id}: hoja externa`);
      const sheet = pngSize(SHEET_FILES[animation.sheet]);
      expect(animation.frames.length, animation.id).toBeGreaterThan(0);
      for (const { frame, steps } of animation.frames) {
        expect(steps, animation.id).toBeGreaterThan(0);
        expect(frame.sx + frame.width, animation.id).toBeLessThanOrEqual(sheet.width);
        expect(frame.sy + frame.height, animation.id).toBeLessThanOrEqual(sheet.height);
      }
    }
  });

  it('el primo lanza con las 6 poses distintas de su fila, como en el juego', () => {
    const wood = ANIMATIONS.find((animation) => animation.id === 'primo-throw-woodBarrel')!;
    const columns = wood.frames.map(({ frame }) => frame.sx / frame.width);
    expect(columns).toEqual([0, 1, 2, 3, 4, 5]);
    // 4 poses de 12 pasos cogiendo impulso y 2 de 12 al soltarlo
    expect(animationLength(wood)).toBe(72);
  });
});

describe('frameIndexAt y frameStart', () => {
  const animation = {
    frames: [{ steps: 10 }, { steps: 5 }, { steps: 20 }],
  } as unknown as SpriteAnimation;

  it('cada paso cae en su frame y la animación vuelve a empezar al acabar', () => {
    expect(frameIndexAt(animation, 0)).toBe(0);
    expect(frameIndexAt(animation, 9.9)).toBe(0);
    expect(frameIndexAt(animation, 10)).toBe(1);
    expect(frameIndexAt(animation, 15)).toBe(2);
    expect(frameIndexAt(animation, 35)).toBe(0);
  });

  it('frameStart es el primer paso de cada frame', () => {
    expect([0, 1, 2].map((index) => frameStart(animation, index))).toEqual([0, 10, 15]);
    expect(frameIndexAt(animation, frameStart(animation, 2))).toBe(2);
  });
});

describe('searchAnimations', () => {
  const names = (query: string) => searchAnimations(ANIMATIONS, query).map(({ name }) => name);

  it('sin texto, salen todas', () => {
    expect(searchAnimations(ANIMATIONS, '  ')).toHaveLength(ANIMATIONS.length);
  });

  it('busca todas las palabras, en cualquier orden, sin mirar tildes ni mayúsculas', () => {
    expect(names('hierro PRIMO')).toEqual(['Primo pijo · lanzar barril de hierro']);
    expect(names('camion')).toEqual(['Camión del nivel 5']);
  });
});
