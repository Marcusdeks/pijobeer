/**
 * Tests de las entidades del motor: jugador, botellas y jefes.
 * Corren en Node, sin navegador ni canvas: la lógica está separada del dibujo.
 */
import { getLevel } from '@pijobeer/shared';
import { describe, expect, it } from 'vitest';
import {
  ARENA,
  BOSS,
  BOSS_COMMON,
  ENEMY,
  ENEMY_BULLET,
  ENEMY_TYPES,
  PLAYER,
  PLAYER_BULLET,
} from '../config';
import { intersects } from '../geometry';
import { playfieldFor } from '../playfield';
import { fakeInput, fixedRandom } from '../testing';
import { Boss } from './Boss';
import { Enemy } from './Enemy';
import { Player } from './Player';

describe('intersects', () => {
  it('detecta solapamiento y no confunde rectángulos que solo se rozan', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(intersects(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(intersects(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  });
});

describe('Player', () => {
  it('no sale del área de juego ni se mete en las paredes', () => {
    const field = { left: 100, right: 700 };
    const player = new Player(400, 300);
    for (let i = 0; i < 200; i++) player.update(fakeInput('left', 'up'), field);
    expect(player.x).toBe(field.left);
    expect(player.y).toBe(PLAYER.topMargin); // sitio para la cabeza y la barra de vida

    for (let i = 0; i < 200; i++) player.update(fakeInput('right', 'down'), field);
    expect(player.x + PLAYER.width).toBe(field.right);
    expect(player.y).toBe(ARENA.height - PLAYER.height);
  });

  it('respeta el tiempo de recarga y dispara abrechapas hacia arriba', () => {
    const player = Player.spawn();
    const shots = Array.from({ length: PLAYER.shootCooldown * 2 }, () =>
      player.update(fakeInput('shoot')),
    ).filter((shot) => shot !== null);

    expect(shots).toHaveLength(2);
    const { y } = shots[0]!;
    shots[0]!.update();
    expect(shots[0]!.y).toBe(y - PLAYER_BULLET.speed);
  });

  it('la vida no baja de 0', () => {
    const player = Player.spawn();
    player.takeDamage(PLAYER.maxHealth + 50);
    expect(player.health).toBe(0);
    expect(player.isDead).toBe(true);
  });
});

describe('Enemy (botella)', () => {
  /** Avanza una botella hasta que dispare; devuelve la bala y el paso. */
  function stepUntilShot(enemy: Enemy, maxSteps = 500) {
    for (let step = 1; step <= maxSteps; step++) {
      const bullet = enemy.update();
      if (bullet) return { bullet, step };
    }
    throw new Error('La botella no ha disparado');
  }

  it('reposa cerrada y reproduce la animación completa al disparar', () => {
    const enemy = new Enemy(100, 100, 'normal', fixedRandom);
    const frames: number[] = [];
    for (let i = 0; i < 400; i++) {
      enemy.update();
      if (frames.at(-1) !== enemy.animationFrame) frames.push(enemy.animationFrame);
    }
    expect(frames.slice(0, 6)).toEqual([0, ...ENEMY.shootAnimation, 0]);
  });

  it('la espuma sale en el frame de la explosión, por el cuello y algo separada', () => {
    const enemy = new Enemy(100, 100, 'normal', fixedRandom);
    const { bullet } = stepUntilShot(enemy);
    expect(enemy.animationFrame).toBe(ENEMY.fireOnFrame);
    expect(bullet.y).toBe(enemy.y + enemy.height + ENEMY.bulletGap);
    expect(bullet.x + bullet.width / 2).toBe(enemy.x + enemy.width / 2);
    expect(bullet.width).toBe(ENEMY_BULLET.width);
  });

  it('cada tipo baja a su velocidad, multiplicada por la del nivel', () => {
    const fall = (type: 'normal' | 'fast' | 'heavy', scale = 1) => {
      const enemy = new Enemy(100, 0, type, fixedRandom, scale);
      enemy.update();
      return enemy.y;
    };
    expect(fall('fast')).toBeGreaterThan(fall('normal'));
    expect(fall('heavy')).toBeLessThan(fall('normal'));
    expect(fall('normal', 1.5)).toBe(ENEMY_TYPES.normal.speed * 1.5);
  });

  it('la pesada dispara el doble de seguido que la normal', () => {
    const gap = (type: 'normal' | 'heavy') => {
      const enemy = new Enemy(100, 0, type, fixedRandom);
      stepUntilShot(enemy);
      return stepUntilShot(enemy).step;
    };
    expect(gap('heavy')).toBeLessThanOrEqual(gap('normal') / 2 + 1);
  });

  it('aparece siempre sobre el suelo, nunca en las paredes', () => {
    const field = playfieldFor(getLevel(2));
    for (const r of [0, 0.5, 0.999]) {
      const enemy = Enemy.spawn('normal', field, () => r);
      expect(enemy.x).toBeGreaterThanOrEqual(field.left);
      expect(enemy.x + ENEMY.width).toBeLessThanOrEqual(field.right);
    }
  });
});

describe('Boss (jefe final)', () => {
  const field = playfieldFor(getLevel(2));

  /** Lleva al jefe hasta su posición de combate. */
  function arrived(id: 'blonde' | 'dark', healthScale = 1) {
    const boss = new Boss(id, field, healthScale);
    while (boss.isEntering) boss.update();
    return boss;
  }

  it('entra sin disparar ni recibir daño, y se queda a su altura sin avanzar', () => {
    const boss = new Boss('blonde', field);
    expect(boss.hit()).toBe(false);

    let bullets = 0;
    while (boss.isEntering) bullets += boss.update().length;
    expect(bullets).toBe(0);

    for (let i = 0; i < 500; i++) boss.update();
    expect(boss.y).toBe(BOSS_COMMON.holdY);
  });

  it('va de pared a pared sin salirse del suelo', () => {
    const boss = arrived('blonde');
    const xs = Array.from({ length: 1500 }, () => (boss.update(), boss.x));
    expect(Math.min(...xs)).toBe(field.left);
    expect(Math.max(...xs) + boss.width).toBe(field.right);
  });

  it('dispara en ráfagas: varios disparos seguidos y una pausa', () => {
    const boss = arrived('blonde');
    const stats = BOSS.blonde;
    const shotSteps: number[] = [];
    for (let step = 0; shotSteps.length < stats.burstSize * 2; step++) {
      if (boss.update().length) shotSteps.push(step);
    }
    const gaps = shotSteps.slice(1).map((s, i) => s - shotSteps[i]!);
    // Dentro de la ráfaga, la espera corta; entre ráfagas, la pausa larga
    expect(gaps.slice(0, stats.burstSize - 1)).toEqual(
      Array(stats.burstSize - 1).fill(stats.burstGap),
    );
    expect(gaps[stats.burstSize - 1]).toBe(stats.burstPause);
  });

  it('el jefe oscuro dispara dos chorros a la vez y tiene más vida', () => {
    const boss = arrived('dark');
    let fired: unknown[] = [];
    while (!fired.length) fired = boss.update();
    expect(fired).toHaveLength(2);
    expect(BOSS.dark.health).toBeGreaterThan(BOSS.blonde.health);
  });

  it('el truco de vida de los jefes multiplica su vida', () => {
    expect(arrived('blonde', 0.5).maxHealth).toBe(BOSS.blonde.health / 2);
  });
});
