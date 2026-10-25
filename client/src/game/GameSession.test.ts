/**
 * Tests de la partida: aparición de enemigos, victoria, jefes, latas, pausa y trucos.
 */
import {
  BOSS_POINTS,
  DEFAULT_GAME_MODIFIERS,
  DIFFICULTIES,
  getLevel,
  POINTS_PER_KILL,
  type GameModifiers,
} from '@pijobeer/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  BOSS,
  BOSS_COMMON,
  CAMERA,
  ENEMY,
  ENEMY_TYPES,
  PICKUP_TYPES,
  PLAYER,
  PLAYER_BULLET,
} from './config';
import { Bullet } from './entities/Bullet';
import { Enemy } from './entities/Enemy';
import { Pickup } from './entities/Pickup';
import { GameSession, type GameSessionOptions } from './GameSession';
import { IDLE_FRAME } from './sprites/playerSprite';
import { fakeInput, fixedRandom, run } from './testing';

function session(levelId: number, options: Partial<GameSessionOptions> = {}) {
  return new GameSession({ levelId, random: fixedRandom, ...options });
}

function withModifiers(changes: Partial<GameModifiers>): GameModifiers {
  return { ...DEFAULT_GAME_MODIFIERS, ...changes };
}

/** Una botella con un abrechapas justo debajo: se elimina en el siguiente paso. */
function addSureKill(game: GameSession) {
  game.enemies.push(new Enemy(300, 100, 'normal', fixedRandom));
  game.playerBullets.push(new Bullet(305, 140, -PLAYER_BULLET.speed, PLAYER_BULLET));
}

/** Pasos que tarda un jefe en entrar desde fuera de la pantalla. */
const BOSS_ENTRY_STEPS = Math.ceil((BOSS_COMMON.holdY + 200) / BOSS_COMMON.enterSpeed);

describe('aparición de botellas y progresión', () => {
  it('salen al ritmo del nivel', () => {
    const game = session(1);
    run(game, game.rules.spawnInterval * 3);
    expect(game.enemies).toHaveLength(3);
  });

  it('cada nivel saca botellas más a menudo y más rápidas que el anterior', () => {
    const [l1, l2, l3] = [1, 2, 3].map((id) => session(id).rules);
    expect(l2!.spawnInterval).toBeLessThan(l1!.spawnInterval);
    expect(l3!.spawnInterval).toBeLessThan(l2!.spawnInterval);
    expect(l2!.enemySpeed).toBeGreaterThan(l1!.enemySpeed);
    expect(l3!.enemySpeed).toBeGreaterThan(l2!.enemySpeed);
  });

  it('en el nivel 1 solo hay botellas normales; desde el nivel 2, mezcla', () => {
    const types = (levelId: number) => {
      const game = session(levelId, { random: Math.random });
      const seen = new Set<string>();
      for (let i = 0; i < 4000; i++) {
        game.step(fakeInput());
        game.enemies.forEach((e) => seen.add(e.type));
        game.player.health = PLAYER.maxHealth;
      }
      return seen;
    };
    expect([...types(1)]).toEqual(['normal']);
    expect(types(2)).toEqual(new Set(['normal', 'fast', 'heavy']));
  });

  it('el tiempo de partida se para en la pausa', () => {
    const game = session(1);
    run(game, 10);
    game.pause();
    run(game, 10);
    expect(game.steps).toBe(10);
  });

  it('mirando hacia delante, el callejón avanza solo y el personaje corre en el sitio', () => {
    const game = session(1, { modifiers: withModifiers({ invincible: true }) });
    const { x, y } = game.player;

    // Empieza mirando hacia delante: sin pulsar nada ya avanza
    const frames = new Set<number>();
    for (let i = 0; i < 60; i++) {
      game.step(fakeInput());
      frames.add(game.player.animationFrame);
    }
    expect(game.backgroundDistance).toBe(60 * CAMERA.advanceSpeed);
    expect([game.player.x, game.player.y]).toEqual([x, y]); // no se mueve de la pantalla...
    expect(frames.size).toBeGreaterThan(1); // ...pero la animación de correr sigue

    // Manteniendo W esprinta: el callejón va más rápido
    run(game, 10, fakeInput('up'));
    expect(game.player.isSprinting).toBe(true);
    expect(game.backgroundDistance).toBe(60 * CAMERA.advanceSpeed + 10 * CAMERA.sprintSpeed);
  });

  it('en diagonal no avanza: solo cuenta mirar recto hacia delante', () => {
    const game = session(1, { modifiers: withModifiers({ invincible: true }) });
    run(game, 10, fakeInput('up', 'left'));
    expect(game.backgroundDistance).toBe(0);
    run(game, 10); // y al soltar sigue mirando en diagonal: parado
    expect(game.backgroundDistance).toBe(0);
  });

  it('mirando a un lado o hacia atrás se para, aunque suelte las teclas', () => {
    const game = session(1, { modifiers: withModifiers({ invincible: true }) });
    for (const key of ['right', 'left', 'down'] as const) {
      game.step(fakeInput(key)); // un toque basta para girarse
      const reached = game.backgroundDistance;
      run(game, 30);
      expect(game.backgroundDistance).toBe(reached);
      expect(game.player.animationFrame).toBe(IDLE_FRAME); // quieto, pose neutra
    }

    // Al volver a mirar hacia delante, sigue avanzando
    game.step(fakeInput('up'));
    const reached = game.backgroundDistance;
    run(game, 10);
    expect(game.backgroundDistance).toBe(reached + 10 * CAMERA.advanceSpeed);
  });

  it('el suelo no arrastra a las botellas: caen a su velocidad, se avance o no', () => {
    const game = session(1, { modifiers: withModifiers({ invincible: true }) });
    game.enemies.push(new Enemy(300, 100, 'normal', fixedRandom));
    const before = game.enemies[0]!.y;
    game.step(fakeInput());
    expect(game.player.isAdvancing).toBe(true);
    expect(game.enemies[0]!.y - before).toBeCloseTo(
      ENEMY_TYPES.normal.speed * getLevel(1).enemySpeed,
    );
  });

  it('contra el jefe el callejón se para', () => {
    const game = session(2, { modifiers: withModifiers({ invincible: true }) });
    game.kills = getLevel(2).killsToComplete;
    game.backgroundDistance = getLevel(2).distanceToComplete;
    game.step(fakeInput());
    expect(game.boss).not.toBeNull();

    const reached = game.backgroundDistance;
    run(game, 10, fakeInput('up'));
    expect(game.backgroundDistance).toBe(reached);
    expect(game.player.isAdvancing).toBe(false);
  });

  it('en los niveles 2 y 3 hay que recorrer el callejón además de eliminar las botellas', () => {
    const game = session(2);
    game.kills = getLevel(2).killsToComplete;
    game.step(fakeInput());
    expect(game.boss).toBeNull();

    game.backgroundDistance = getLevel(2).distanceToComplete;
    game.step(fakeInput());
    expect(game.boss).not.toBeNull();
  });

  it('si un admin fija las botellas a eliminar, no hace falta recorrer el callejón', () => {
    const rules = session(3, { modifiers: withModifiers({ killsToComplete: 5 }) }).rules;
    expect(rules.distanceToComplete).toBe(0);
  });

  it('se dispara menos cuanto más difícil (3 / 2,5 / 2 disparos por segundo)', () => {
    const shotsPerSecond = (difficulty: 'easy' | 'normal' | 'hard') =>
      60 / session(1, { difficulty }).rules.shootCooldown;
    expect(shotsPerSecond('easy')).toBe(3);
    expect(shotsPerSecond('normal')).toBe(2.5);
    expect(shotsPerSecond('hard')).toBe(2);
  });
});

describe('fin de partida', () => {
  it('sin jefe, se gana al eliminar las botellas del nivel (y se avisa una vez)', () => {
    const onVictory = vi.fn();
    const game = session(1, { events: { onVictory } });
    const required = getLevel(1).killsToComplete;

    for (let i = 0; i < required + 5; i++) {
      addSureKill(game);
      game.step(fakeInput());
    }

    expect(game.status).toBe('victory');
    expect(game.kills).toBe(required);
    expect(onVictory).toHaveBeenCalledTimes(1);
    expect(onVictory).toHaveBeenCalledWith({
      level: 1,
      kills: required,
      points: required * POINTS_PER_KILL,
    });
  });

  it('sin vida, termina la partida', () => {
    const onGameOver = vi.fn();
    const game = session(1, { events: { onGameOver } });
    game.player.takeDamage(PLAYER.maxHealth);
    run(game, 2);
    expect(game.status).toBe('over');
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it('el choque con una botella quita más vida que una bala', () => {
    const game = session(1);
    game.enemies.push(new Enemy(game.player.x, game.player.y, 'normal', fixedRandom));
    game.step(fakeInput());
    expect(game.player.health).toBe(PLAYER.maxHealth - ENEMY.contactDamage);
  });
});

describe('jefes finales', () => {
  /** Partida del nivel 2 con el jefe ya colocado arriba. */
  function bossFight() {
    const onBossAppear = vi.fn();
    const onVictory = vi.fn();
    const game = session(2, { events: { onBossAppear, onVictory } });
    game.kills = getLevel(2).killsToComplete;
    game.backgroundDistance = getLevel(2).distanceToComplete;
    run(game, BOSS_ENTRY_STEPS);
    return { game, boss: game.boss!, onBossAppear, onVictory };
  }

  it('al cumplir el objetivo entra el jefe (sin ganar aún)', () => {
    const { boss, onBossAppear, onVictory } = bossFight();
    expect(boss.id).toBe('blonde');
    expect(onBossAppear).toHaveBeenCalledTimes(1);
    expect(onVictory).not.toHaveBeenCalled();
  });

  it('durante el combate siguen cayendo botellas, pero a menor ritmo', () => {
    const { game } = bossFight();
    const { spawnInterval } = getLevel(2);
    game.enemies = [];
    let spawned = 0;
    for (let i = 0; i < spawnInterval * BOSS_COMMON.minionSpawnFactor; i++) {
      // Sin balas del jefe: aquí solo se cuentan las botellas, no se busca morir
      game.enemyBullets = [];
      const before = game.enemies.length;
      game.step(fakeInput());
      if (game.enemies.length > before) spawned++;
    }
    expect(spawned).toBe(1);
  });

  it('su contacto quita vida una vez y espera antes de volver a hacerlo', () => {
    const { game, boss } = bossFight();
    game.enemyBullets = [];
    game.player.x = boss.x;
    game.player.y = boss.y;
    game.step(fakeInput());
    game.enemyBullets = [];
    expect(game.player.health).toBe(PLAYER.maxHealth - BOSS_COMMON.contactDamage);
  });

  it('al derrotarlo se gana el nivel, con su premio sumado a los puntos', () => {
    const { game, boss, onVictory } = bossFight();
    for (let i = 0; i < BOSS.blonde.health && game.status === 'running'; i++) {
      game.enemyBullets = [];
      game.playerBullets.push(
        new Bullet(
          boss.x + boss.width / 2,
          boss.y + boss.height,
          -PLAYER_BULLET.speed,
          PLAYER_BULLET,
        ),
      );
      game.step(fakeInput());
    }
    const kills = getLevel(2).killsToComplete;
    expect(game.status).toBe('victory');
    expect(onVictory).toHaveBeenCalledWith({
      level: 2,
      kills,
      points: kills * POINTS_PER_KILL + BOSS_POINTS.blonde,
    });
  });
});

describe('dificultad', () => {
  it('en difícil las botellas van más rápido y salen más a menudo que en fácil', () => {
    const easy = session(2, { difficulty: 'easy' }).rules;
    const hard = session(2, { difficulty: 'hard' }).rules;
    expect(hard.enemySpeed).toBeGreaterThan(easy.enemySpeed);
    expect(hard.spawnInterval).toBeLessThan(easy.spawnInterval);
    expect(hard.bossHealth).toBeGreaterThan(easy.bossHealth);
  });

  it('cambia la vida que quita cada golpe', () => {
    const game = session(1, { difficulty: 'easy' });
    game.enemies.push(new Enemy(game.player.x, game.player.y, 'normal', fixedRandom));
    game.step(fakeInput());
    expect(game.player.health).toBe(
      PLAYER.maxHealth - ENEMY.contactDamage * DIFFICULTIES.easy.damageTaken,
    );
  });

  it('multiplica los puntos, siempre en múltiplos de POINTS_PER_KILL', () => {
    const normal = session(1);
    const hard = session(1, { difficulty: 'hard' });
    const easy = session(1, { difficulty: 'easy' });
    for (const game of [normal, hard, easy]) game.kills = 3;
    expect(hard.points).toBe(normal.points * DIFFICULTIES.hard.points);
    expect(easy.points % POINTS_PER_KILL).toBe(0);
  });
});

describe('latas', () => {
  /** Pone una lata justo encima del jugador: la recoge en el siguiente paso. */
  function addPickupOnPlayer(game: GameSession, type: Pickup['type']) {
    game.pickups.push(new Pickup(game.player.x, game.player.y, type));
  }

  it('salen cada cierto tiempo, más a menudo en fácil y menos en difícil', () => {
    const [easy, normal, hard] = (['easy', 'normal', 'hard'] as const).map(
      (difficulty) => session(1, { difficulty }).rules.pickupInterval,
    );
    expect(easy).toBeLessThan(normal!);
    expect(hard).toBeGreaterThan(normal!);

    // Inmortal: en 15 s las botellas acabarían con el jugador y la partida se pararía
    const game = session(1, { modifiers: withModifiers({ invincible: true }) });
    run(game, game.rules.pickupInterval - 1);
    expect(game.pickups).toHaveLength(0);
    game.step(fakeInput());
    expect(game.pickups).toHaveLength(1);
  });

  it('la verde cura sin pasar del máximo; en difícil cura lo mismo que en normal', () => {
    const game = session(1);
    game.player.health = 50;
    addPickupOnPlayer(game, 'health');
    game.step(fakeInput());
    expect(game.player.health).toBe(50 + PICKUP_TYPES.health.heal);
    expect(game.pickups).toHaveLength(0);

    addPickupOnPlayer(game, 'health');
    game.step(fakeInput());
    addPickupOnPlayer(game, 'health');
    game.step(fakeInput());
    expect(game.player.health).toBe(PLAYER.maxHealth);

    const healOf = (difficulty: 'easy' | 'normal' | 'hard') =>
      session(1, { difficulty }).rules.healAmount;
    expect(healOf('hard')).toBe(healOf('normal'));
    expect(healOf('easy')).toBeGreaterThan(healOf('normal'));
  });

  it('la de velocidad hace disparar el doble de rápido durante un rato', () => {
    /** Disparos en `steps` pasos: cada abrechapas nuevo cuenta (aunque luego salga de la pantalla). */
    const shotsIn = (game: GameSession, steps: number) => {
      const seen = new Set(game.playerBullets);
      const before = seen.size;
      for (let i = 0; i < steps; i++) {
        game.enemies = []; // sin botellas: ninguna bala desaparece antes de contarla
        game.step(fakeInput('shoot'));
        game.playerBullets.forEach((bullet) => seen.add(bullet));
      }
      return seen.size - before;
    };
    // Inmortal: las balas enemigas no deben acabar la partida a mitad del test
    const game = session(1, { modifiers: withModifiers({ invincible: true }) });
    addPickupOnPlayer(game, 'speed');
    game.step(fakeInput());
    expect(game.player.boostPercent).toBeGreaterThan(0);

    const cooldown = game.rules.shootCooldown;
    expect(shotsIn(game, cooldown * 4)).toBe(4 * PICKUP_TYPES.speed.fireRateScale);

    run(game, PICKUP_TYPES.speed.durationSteps);
    expect(game.player.boostPercent).toBe(0);
    expect(shotsIn(game, cooldown * 4)).toBe(4);
  });

  it('las balas del jugador las atraviesan', () => {
    const game = session(1);
    game.pickups.push(new Pickup(300, 100, 'health'));
    game.playerBullets.push(new Bullet(305, 120, -PLAYER_BULLET.speed, PLAYER_BULLET));
    game.step(fakeInput());
    expect(game.pickups).toHaveLength(1);
  });
});

describe('pausa', () => {
  it('en pausa no avanza nada, y al reanudar sigue', () => {
    const onStatusChange = vi.fn();
    const game = session(1, { events: { onStatusChange } });
    game.pause();
    const { x } = game.player;
    run(game, 100, fakeInput('right'));
    expect(game.player.x).toBe(x);

    game.resume();
    game.step(fakeInput('right'));
    expect(game.player.x).toBe(x + PLAYER.speed);
    expect(onStatusChange.mock.calls).toEqual([['paused'], ['running']]);
  });

  it('una partida terminada no se puede pausar', () => {
    const game = session(1);
    game.player.takeDamage(PLAYER.maxHealth);
    game.step(fakeInput());
    game.togglePause();
    expect(game.status).toBe('over');
  });
});

describe('trucos de administrador', () => {
  it('inmortal: el jugador no pierde vida', () => {
    const game = session(1, { modifiers: withModifiers({ invincible: true }) });
    game.enemies.push(new Enemy(game.player.x, game.player.y, 'normal', fixedRandom));
    game.step(fakeInput());
    expect(game.player.health).toBe(PLAYER.maxHealth);
  });

  it('cambia las botellas a eliminar en todos los niveles', () => {
    const game = session(1, { modifiers: withModifiers({ killsToComplete: 2 }) });
    addSureKill(game);
    game.step(fakeInput());
    addSureKill(game);
    game.step(fakeInput());
    expect(game.status).toBe('victory');
  });

  it('más ritmo de aparición = más botellas', () => {
    const count = (spawnRate: number) => {
      const game = session(1, { modifiers: withModifiers({ spawnRate }) });
      run(game, 600);
      return game.enemies.length;
    };
    expect(count(2)).toBeGreaterThan(count(1));
  });
});
