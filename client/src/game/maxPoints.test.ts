/**
 * El tope del antitrampas (maxPointsFor, en el paquete compartido) nunca puede
 * quedarse corto: si un jugador honrado consiguiera más puntos, el servidor
 * rechazaría su partida.
 *
 * maxPointsFor está escrito a mano a partir de los ritmos de aparición, así que
 * aquí se comprueba con el motor de verdad: un jugador "perfecto" que elimina
 * todo en cuanto aparece, en Difícil (la que más puntos da). Juega de dos
 * maneras: esprintando hasta los jefes y aguantando el combate con ellos en
 * furia (cuando más botellas lanzan) antes de derrotarlos, y sin avanzar
 * nunca, para que no dejen de caer botellas. Si alguien cambia los
 * números del juego y el tope deja de cubrirlos, este test falla.
 */
import { DEFAULT_GAME_MODIFIERS, LEVELS, maxPointsFor } from '@pijobeer/shared';
import { describe, expect, it } from 'vitest';
import { PLAYER_BULLET, SIMULATION_STEPS_PER_SECOND } from './config';
import { Bullet } from './entities/Bullet';
import { GameSession } from './GameSession';
import type { InputState } from './input/InputState';
import { fakeInput, noInput } from './testing';

/** Aleatorio con semilla (mulberry32): variado, para que salgan todos los tipos, pero repetible. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Juega `seconds` segundos eliminando todo lo que aparece. Devuelve los puntos. */
function playPerfectly(levelId: number, seconds: number, input: InputState): number {
  const game = new GameSession({
    levelId,
    difficulty: 'hard',
    // Inmortal solo para que no se acabe la partida: no cambia los puntos
    modifiers: { ...DEFAULT_GAME_MODIFIERS, invincible: true },
    random: seededRandom(levelId),
  });
  for (let step = 0; step < seconds * SIMULATION_STEPS_PER_SECOND; step++) {
    // Un abrechapas encima de cada enemigo: muere en este mismo paso (o recibe un impacto)
    for (const enemy of game.enemies) {
      const x = enemy.x + enemy.width / 2 - PLAYER_BULLET.width / 2;
      game.playerBullets.push(new Bullet(x, enemy.y + enemy.height / 2, 0, PLAYER_BULLET));
    }
    // Los jefes se quedan a un golpe de morir: en furia y sin dejar de lanzar
    for (const boss of game.bosses) {
      if (!boss.isEntering && boss.health > PLAYER_BULLET.damage) boss.hit();
    }
    game.step(input);
  }
  // Al que aún esté entrando (el alcalde, saliendo de detrás de su mesa) no se le puede dar
  for (const boss of game.bosses) while (!boss.isEntering && !boss.isDead) boss.hit();
  game.step(input);
  return game.points;
}

describe('maxPointsFor (antitrampas)', () => {
  it.each(LEVELS.map((level) => level.id))(
    'el nivel %i no da más puntos de los que permite el tope',
    (levelId) => {
      for (const input of [fakeInput('up'), noInput]) {
        for (const seconds of [20, 180]) {
          const points = playPerfectly(levelId, seconds, input);
          expect(points).toBeLessThanOrEqual(maxPointsFor(levelId, seconds));
        }
      }
    },
  );
});
