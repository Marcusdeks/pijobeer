/**
 * Tests de las entidades del motor: jugador (y su chupa), botellas, barriles y jefes.
 * Corren en Node, sin navegador ni canvas: la lógica está separada del dibujo.
 */
import { getLevel, type BossId } from '@pijobeer/shared';
import { describe, expect, it } from 'vitest';
import {
  ARENA,
  BOSS,
  BOSS_COMMON,
  BOSS_ENRAGE,
  ENEMY,
  ENEMY_BULLET,
  ENEMY_TYPES,
  JACKET,
  PLAYER,
  PLAYER_BULLET,
  THROWN_BOTTLE,
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
    for (let i = 0; i < 200; i++) player.update(fakeInput('left', 'up'), { field });
    expect(player.x).toBe(field.left);
    expect(player.y).toBe(PLAYER.minY); // como mucho, media pantalla

    for (let i = 0; i < 200; i++) player.update(fakeInput('right', 'down'), { field });
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

  it('dispara siempre recto hacia arriba, mire hacia donde mire', () => {
    for (const key of ['left', 'down', 'right'] as const) {
      const player = new Player(400, 400);
      player.update(fakeInput(key)); // se gira
      const shot = player.update(fakeInput('shoot'))!;
      expect([shot.velocityX, shot.velocityY]).toEqual([0, -PLAYER_BULLET.speed]);
    }
  });

  it('con la chupa (B) se queda quieto y no dispara, solo donde el nivel lo permite', () => {
    const shielded = new Player(400, 400);
    for (let i = 0; i < 10; i++) {
      const shot = shielded.update(fakeInput('shield', 'left', 'shoot'), { jacketAllowed: true });
      expect(shot).toBeNull();
    }
    expect(shielded.isShielding).toBe(true);
    expect([shielded.x, shielded.y]).toEqual([400, 400]);

    // En un nivel sin chupa, la B no hace nada
    const normal = new Player(400, 400);
    normal.update(fakeInput('shield', 'left'));
    expect(normal.isShielding).toBe(false);
    expect(normal.x).toBe(400 - PLAYER.speed);
  });

  it('la chupa para 3 chorros, se empapa y tarda en secarse', () => {
    const player = new Player(400, 400);
    const shield = () => player.update(fakeInput('shield'), { jacketAllowed: true });
    shield();
    for (let i = 0; i < JACKET.maxBlocks - 1; i++) {
      player.blockShot();
      expect(player.isShielding).toBe(true);
    }
    player.blockShot(); // el tercero la empapa
    expect(player.isShielding).toBe(false);
    expect(player.dryingPercent).toBe(100);

    for (let i = 0; i < JACKET.dryingSteps - 1; i++) {
      shield();
      expect(player.isShielding).toBe(false); // aún mojada
    }
    shield();
    expect(player.isShielding).toBe(true); // ya seca
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
    expect([bullet.velocityX, bullet.velocityY]).toEqual([0, ENEMY_BULLET.speed]); // recta hacia abajo
  });

  it('el barril pequeño aguanta 3 impactos y apunta al jugador', () => {
    const barrel = new Enemy(100, 100, 'barrel', fixedRandom);
    expect(barrel.hit()).toBe(false);
    expect(barrel.hit()).toBe(false);
    expect(barrel.isFlashing).toBe(true); // avisa de que el impacto ha contado
    expect(barrel.hit()).toBe(true);
    expect(barrel.alive).toBe(false);

    const shooter = new Enemy(100, 100, 'barrel', fixedRandom);
    const target = { x: 400, y: 450 };
    let bullet = shooter.update(target);
    while (!bullet) bullet = shooter.update(target);
    expect(bullet.velocityX).toBeGreaterThan(0);
    expect(bullet.velocityY).toBeGreaterThan(0);
  });

  it('el barril va a la velocidad de la botella pesada', () => {
    expect(ENEMY_TYPES.barrel.speed).toBe(ENEMY_TYPES.heavy.speed);
  });

  it('la botella lanzada gira poco a poco hacia el jugador y, al pasarle, sigue recta', () => {
    const target = { x: 600, y: 450 };
    const bottle = Enemy.thrownAt('normal', { x: 400, y: 100 }, { x: 400, y: 450 }, fixedRandom);
    expect(bottle.heading).toBe(0);

    bottle.update(target);
    expect(bottle.heading).toBeCloseTo(THROWN_BOTTLE.turnDeg); // gira, pero solo un poco
    for (let i = 0; i < 300 && bottle.center.y < target.y; i++) bottle.update(target);
    expect(bottle.heading).toBeGreaterThan(0);

    const heading = bottle.heading;
    bottle.update({ x: 0, y: 450 }); // ya le ha pasado: no vuelve a por él
    expect(bottle.heading).toBe(heading);
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
  function arrived(id: BossId, healthScale = 1) {
    const boss = new Boss(id, field, { healthScale, random: fixedRandom });
    while (boss.isEntering) boss.update();
    return boss;
  }

  /** Avanza hasta el siguiente ataque y devuelve lo lanzado. */
  function nextAttack(boss: Boss, target?: { x: number; y: number }) {
    let attack = boss.update(target);
    while (!attack.bullets.length && !attack.bottles.length) attack = boss.update(target);
    return attack;
  }
  const nextShot = (boss: Boss, target?: { x: number; y: number }) =>
    nextAttack(boss, target).bullets;

  /** Pasos en los que ataca, durante `steps` pasos. */
  function attackSteps(boss: Boss, steps: number) {
    const result: number[] = [];
    for (let step = 0; step < steps; step++) {
      const { bullets, bottles } = boss.update();
      if (bullets.length || bottles.length) result.push(step);
    }
    return result;
  }

  /** Lleva al jefe a su fase de furia quitándole la vida de 1 en 1. */
  function enrage(boss: Boss) {
    while (!boss.isEnraged) boss.hit(1);
  }

  it('entra sin disparar ni recibir daño, y se queda a su altura sin avanzar', () => {
    const boss = new Boss('wood', field);
    expect(boss.hit()).toBe(false);

    let bullets = 0;
    while (boss.isEntering) bullets += boss.update().bullets.length;
    expect(bullets).toBe(0);

    for (let i = 0; i < 500; i++) boss.update();
    expect(boss.y).toBe(BOSS_COMMON.holdY);
  });

  it('va de pared a pared sin salirse del suelo', () => {
    const boss = arrived('wood');
    const xs = Array.from({ length: 1500 }, () => (boss.update(), boss.x));
    expect(Math.min(...xs)).toBe(field.left);
    expect(Math.max(...xs) + boss.width).toBe(field.right);
  });

  it('cada abrechapas le quita PLAYER_BULLET.damage: el de madera cae en 16', () => {
    const boss = arrived('wood');
    boss.hit();
    expect(boss.health).toBe(BOSS.wood.health - PLAYER_BULLET.damage);
    for (let i = 1; i < 16; i++) boss.hit();
    expect(boss.isDead).toBe(true);
  });

  it('dispara en ráfagas: varios disparos seguidos y una pausa', () => {
    const boss = arrived('wood');
    const stats = BOSS.wood;
    const shotSteps = attackSteps(boss, 400).slice(0, stats.burstSize * 2);
    const gaps = shotSteps.slice(1).map((s, i) => s - shotSteps[i]!);
    // Dentro de la ráfaga, la espera corta; entre ráfagas, la pausa larga
    expect(gaps.slice(0, stats.burstSize - 1)).toEqual(
      Array(stats.burstSize - 1).fill(stats.burstGap),
    );
    expect(gaps[stats.burstSize - 1]).toBe(stats.burstPause);
  });

  it('el de madera, con furia, hace la mitad de ráfagas (del mismo tamaño)', () => {
    const stats = BOSS.wood;
    const burstLength = (stats.burstSize - 1) * stats.burstGap;
    // Ciclo de ráfaga + pausa: antes la pausa se reducía a la mitad; ahora crece
    const before = burstLength + Math.round(stats.burstPause * 0.5);
    const now = burstLength + Math.round(stats.burstPause * stats.enragedPauseScale);
    expect(now / before).toBeCloseTo(2, 0);

    const boss = arrived('wood');
    enrage(boss);
    const steps = attackSteps(boss, 600);
    const firstOfEachBurst = steps.filter((s, i) => i === 0 || s - steps[i - 1]! > stats.burstGap);
    expect(firstOfEachBurst[2]! - firstOfEachBurst[1]!).toBe(now);
  });

  it('el de madera apunta al jugador: si está a la derecha, la espuma va hacia la derecha', () => {
    const boss = arrived('wood');
    const [bullet] = nextShot(boss, { x: field.right, y: 450 });
    expect(bullet!.velocityX).toBeGreaterThan(0);
    expect(bullet!.velocityY).toBeGreaterThan(0);
  });

  it('nunca dispara casi en horizontal, aunque el jugador esté pegado a un lado', () => {
    const boss = arrived('wood');
    const [bullet] = nextShot(boss, { x: boss.x + 1000, y: boss.y + boss.height + 1 });
    const degrees = (Math.atan2(bullet!.velocityX, bullet!.velocityY) * 180) / Math.PI;
    expect(degrees).toBeCloseTo(BOSS_COMMON.maxAimDeg);
  });

  it('el de hierro dispara un abanico de chorros y tiene más vida', () => {
    const fired = nextShot(arrived('iron'));
    expect(fired).toHaveLength(BOSS.iron.streams);
    // Sin objetivo, el abanico es simétrico alrededor de la vertical
    const vx = fired.map((b) => b.velocityX);
    expect(Math.min(...vx)).toBeCloseTo(-Math.max(...vx));
    expect(BOSS.iron.health).toBeGreaterThan(BOSS.wood.health);
  });

  it('entra en furia cuando le queda un 20 % de vida: más chorros por disparo', () => {
    const boss = arrived('iron');
    while (boss.healthPercent > BOSS_ENRAGE.enrageAt * 100 + 1) {
      boss.hit(1);
      expect(boss.isEnraged).toBe(false);
    }
    enrage(boss);
    expect(boss.healthPercent).toBeLessThanOrEqual(20);
    expect(nextShot(boss)).toHaveLength(BOSS.iron.streams + BOSS.iron.enragedExtraStreams);
  });

  it('el de hierro deja huecos para esquivar: chorros separados al menos 20°, también con furia', () => {
    const angles = (boss: Boss) =>
      nextShot(boss)
        .map((b) => (Math.atan2(b.velocityX, b.velocityY) * 180) / Math.PI)
        .sort((a, b) => a - b);
    const minGap = (degrees: number[]) =>
      Math.min(...degrees.slice(1).map((d, i) => d - degrees[i]!));

    const boss = arrived('iron');
    expect(minGap(angles(boss))).toBeGreaterThanOrEqual(20);
    enrage(boss);
    expect(minGap(angles(boss))).toBeGreaterThanOrEqual(20);
  });

  it('el pijo no dispara espuma: lanza botellas que van a por el jugador', () => {
    const { bullets, bottles } = nextAttack(arrived('pijo'), { x: 400, y: 450 });
    expect(bullets).toHaveLength(0);
    expect(bottles).toHaveLength(1);
    expect(bottles[0]!.thrown).toBe(true);
    expect(['normal', 'fast', 'heavy']).toContain(bottles[0]!.type);
  });

  it('dos jefes a la vez empiezan separados y salen en direcciones opuestas', () => {
    const [left, right] = [0, 1].map((slot) => new Boss('pijo', field, { slot, count: 2 }));
    expect(left!.x + left!.width).toBeLessThan(right!.x);
    const [leftX, rightX] = [left!.x, right!.x];
    while (left!.isEntering) [left, right].forEach((boss) => boss!.update());
    left!.update();
    right!.update();
    expect(left!.x).toBeGreaterThan(leftX);
    expect(right!.x).toBeLessThan(rightX);
  });

  it('el truco de vida de los jefes multiplica su vida', () => {
    expect(arrived('wood', 0.5).maxHealth).toBe(BOSS.wood.health / 2);
  });
});
