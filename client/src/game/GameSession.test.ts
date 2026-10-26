/**
 * Tests de la partida: aparición de enemigos, victoria, jefes, latas, pausa y trucos.
 */
import {
  BOSS_POINTS,
  DEFAULT_GAME_MODIFIERS,
  DIFFICULTIES,
  ENEMY_POINTS,
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
  ENEMY_BULLET,
  ENEMY_TYPES,
  JACKET,
  PICKUP,
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
    // Mirando a un lado no avanza: las botellas caen solo a su ritmo y la primera sigue en pantalla
    game.player.facing = 'izquierda';
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

  it('no sube de media pantalla; ahí, manteniendo W, el callejón va aún más rápido', () => {
    const game = session(1, { modifiers: withModifiers({ invincible: true }) });
    run(game, 100, fakeInput('up'));
    expect(game.player.y).toBe(PLAYER.minY);

    const reached = game.backgroundDistance;
    run(game, 10, fakeInput('up'));
    expect(game.player.y).toBe(PLAYER.minY);
    expect(game.backgroundDistance).toBe(reached + 10 * CAMERA.lineSpeed);
  });

  it('en diagonal avanza más despacio y solo mientras se pulsa', () => {
    const game = session(1, { modifiers: withModifiers({ invincible: true }) });
    run(game, 10, fakeInput('up', 'left'));
    expect(game.backgroundDistance).toBeCloseTo(10 * CAMERA.sprintSpeed * CAMERA.diagonalScale);

    // Pegado a media pantalla, también más rápido (y también con el recorte de la diagonal)
    run(game, 100, fakeInput('up', 'right'));
    const reached = game.backgroundDistance;
    run(game, 10, fakeInput('up', 'right'));
    expect(game.backgroundDistance - reached).toBeCloseTo(
      10 * CAMERA.lineSpeed * CAMERA.diagonalScale,
    );

    // Al soltar sigue mirando en diagonal, pero no avanza solo
    const released = game.backgroundDistance;
    run(game, 10);
    expect(game.backgroundDistance).toBe(released);
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

  it('al avanzar, botellas, latas y espuma se acercan además a la velocidad del callejón', () => {
    const game = session(1, { modifiers: withModifiers({ invincible: true }) });
    const fall = ENEMY_TYPES.normal.speed * getLevel(1).enemySpeed;
    const things = () => [game.enemies[0]!, game.pickups[0]!, game.enemyBullets[0]!];
    const place = () => {
      game.enemies = [new Enemy(300, 100, 'normal', fixedRandom)];
      game.pickups = [new Pickup(400, 100, 'health')];
      game.enemyBullets = [new Bullet(500, 100, ENEMY_BULLET.speed, ENEMY_BULLET)];
    };
    const ownSpeeds = [fall, PICKUP.fallSpeed, ENEMY_BULLET.speed];

    // Avanzando con W: su propia caída más el avance del callejón
    place();
    game.step(fakeInput('up'));
    const advance = game.player.advanceSpeed;
    expect(advance).toBe(CAMERA.sprintSpeed);
    things().forEach((thing, i) => expect(thing.y - 100).toBeCloseTo(ownSpeeds[i]! + advance));

    // Parado (mirando a un lado): solo su propia caída
    place();
    game.step(fakeInput('left'));
    expect(game.player.advanceSpeed).toBe(0);
    things().forEach((thing, i) => expect(thing.y - 100).toBeCloseTo(ownSpeeds[i]!));
  });

  it('contra el jefe el callejón se para', () => {
    const game = session(2, { modifiers: withModifiers({ invincible: true }) });
    game.kills = getLevel(2).killsToComplete;
    game.backgroundDistance = getLevel(2).distanceToComplete;
    game.step(fakeInput());
    expect(game.bosses).toHaveLength(1);

    const reached = game.backgroundDistance;
    run(game, 10, fakeInput('up'));
    expect(game.backgroundDistance).toBe(reached);
    expect(game.player.isAdvancing).toBe(false);
  });

  it('en los niveles 2 y 3 hay que recorrer el callejón además de eliminar las botellas', () => {
    const game = session(2);
    game.kills = getLevel(2).killsToComplete;
    game.step(fakeInput());
    expect(game.bosses).toHaveLength(0);

    game.backgroundDistance = getLevel(2).distanceToComplete;
    game.step(fakeInput());
    expect(game.bosses).toHaveLength(1);
  });

  it('si un admin fija las botellas a eliminar, no hace falta recorrer el callejón', () => {
    const rules = session(3, { modifiers: withModifiers({ killsToComplete: 5 }) }).rules;
    expect(rules.distanceToComplete).toBe(0);
  });

  it('se dispara menos cuanto más difícil (~3,5 / 3 / 2,4 disparos por segundo)', () => {
    const shotsPerSecond = (difficulty: 'easy' | 'normal' | 'hard') =>
      60 / session(1, { difficulty }).rules.shootCooldown;
    // En fácil la espera se redondea a pasos enteros (17), así que no es exactamente 3,6
    expect(shotsPerSecond('easy')).toBeCloseTo(3.5, 1);
    expect(shotsPerSecond('normal')).toBe(3);
    expect(shotsPerSecond('hard')).toBe(2.4);
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
    return { game, boss: game.bosses[0]!, onBossAppear, onVictory };
  }

  it('al cumplir el objetivo entra el jefe (sin ganar aún)', () => {
    const { boss, onBossAppear, onVictory } = bossFight();
    expect(boss.id).toBe('wood');
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
    // El jugador no sube de media pantalla, así que es el jefe el que se le pone encima
    boss.x = game.player.x;
    boss.y = game.player.y;
    game.step(fakeInput());
    game.enemyBullets = [];
    expect(game.player.health).toBe(PLAYER.maxHealth - BOSS_COMMON.contactDamage);
  });

  it('al derrotarlo se gana el nivel, con su premio sumado a los puntos', () => {
    const { game, boss, onVictory } = bossFight();
    for (let i = 0; i < BOSS.wood.health && game.status === 'running'; i++) {
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
    // Las botellas del objetivo se han puesto a mano (sin puntos): solo cuentan las
    // que hayan caído de verdad durante el combate, más el premio del jefe
    const forced = getLevel(2).killsToComplete;
    expect(game.status).toBe('victory');
    expect(onVictory).toHaveBeenCalledWith({
      level: 2,
      kills: game.kills,
      points: (game.kills - forced) * POINTS_PER_KILL + BOSS_POINTS.wood,
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
    for (const game of [normal, hard, easy]) {
      for (let i = 0; i < 3; i++) {
        addSureKill(game);
        game.step(fakeInput());
      }
    }
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

describe('la chupa en la partida', () => {
  /** Un chorro de espuma justo encima del jugador: le da en el siguiente paso. */
  function addFoamOnPlayer(game: GameSession) {
    const { x, y } = game.player;
    game.enemyBullets.push(new Bullet(x + 10, y + 10, 0, ENEMY_BULLET));
  }

  it('desde el nivel 3, manteniendo la B, para la espuma; al tercer chorro se empapa', () => {
    const game = session(3);
    for (let i = 0; i < JACKET.maxBlocks; i++) {
      game.enemies = [];
      addFoamOnPlayer(game);
      game.step(fakeInput('shield'));
      expect(game.player.health).toBe(PLAYER.maxHealth);
    }
    // Empapada: el siguiente chorro ya hace daño aunque siga pulsando la B
    game.enemies = [];
    addFoamOnPlayer(game);
    game.step(fakeInput('shield'));
    expect(game.player.health).toBe(PLAYER.maxHealth - ENEMY.bulletDamage);
  });

  it('en los niveles 1 y 2 la B no hace nada', () => {
    const game = session(2);
    addFoamOnPlayer(game);
    game.step(fakeInput('shield'));
    expect(game.player.isShielding).toBe(false);
    expect(game.player.health).toBe(PLAYER.maxHealth - ENEMY.bulletDamage);
  });

  it('no protege de los botellazos', () => {
    const game = session(4);
    game.step(fakeInput('shield'));
    game.enemies.push(new Enemy(game.player.x, game.player.y, 'normal', fixedRandom));
    game.step(fakeInput('shield'));
    expect(game.player.isShielding).toBe(true);
    expect(game.player.health).toBe(PLAYER.maxHealth - ENEMY.contactDamage);
  });
});

describe('textos de historia', () => {
  it('al empezar, la partida se para hasta que se cierra el texto', () => {
    const onDialog = vi.fn();
    const game = session(4, { dialogs: ['opening'], events: { onDialog } });
    run(game, 30, fakeInput('right'));
    expect(game.status).toBe('dialog');
    expect(onDialog).toHaveBeenCalledWith('opening');
    expect(game.steps).toBe(0);

    game.togglePause(); // la P no hace nada mientras se lee
    expect(game.status).toBe('dialog');

    game.closeDialog();
    game.step(fakeInput());
    expect(game.status).toBe('running');
    expect(game.steps).toBe(1);
    expect(onDialog).toHaveBeenCalledTimes(1); // cada texto, una sola vez
  });

  it('antes de los jefes, la partida se para y entran al cerrar el texto', () => {
    const onDialog = vi.fn();
    const game = session(3, { dialogs: ['beforeBosses'], events: { onDialog } });
    game.kills = getLevel(3).killsToComplete;
    game.backgroundDistance = getLevel(3).distanceToComplete;
    game.step(fakeInput());
    expect(game.status).toBe('dialog');
    expect(onDialog).toHaveBeenCalledWith('beforeBosses');
    expect(game.bosses).toHaveLength(0);

    game.closeDialog();
    game.step(fakeInput());
    expect(game.bosses).toHaveLength(1);
  });

  it('sin textos pedidos, no se para nunca', () => {
    const game = session(4);
    game.kills = getLevel(4).killsToComplete;
    game.backgroundDistance = getLevel(4).distanceToComplete;
    game.step(fakeInput());
    expect(game.status).toBe('running');
  });
});

describe('nivel 4', () => {
  it('salen barriles pequeños, pocos (un 4 %), que dan más puntos', () => {
    const { pickEnemyType } = session(4).rules;
    const rolls = 1000;
    let barrels = 0;
    for (let i = 0; i < rolls; i++) if (pickEnemyType(() => i / rolls) === 'barrel') barrels++;
    expect(barrels / rolls).toBeCloseTo(0.04, 2);

    const game = session(4, { modifiers: withModifiers({ invincible: true }) });
    game.enemies.push(new Enemy(300, 100, 'barrel', fixedRandom));
    for (let i = 0; i < ENEMY_TYPES.barrel.hits; i++) {
      game.playerBullets.push(new Bullet(305, 130, 0, PLAYER_BULLET));
      game.step(fakeInput('left'));
    }
    expect(game.kills).toBe(1);
    expect(game.points).toBe(ENEMY_POINTS.barrel);
  });

  it('al final salen dos pijos; se gana al derrotar a los dos y cuentan los dos', () => {
    const onVictory = vi.fn();
    const game = session(4, {
      events: { onVictory },
      modifiers: withModifiers({ invincible: true }),
    });
    game.kills = getLevel(4).killsToComplete;
    game.backgroundDistance = getLevel(4).distanceToComplete;
    run(game, BOSS_ENTRY_STEPS);
    expect(game.bosses.map((boss) => boss.id)).toEqual(['pijo', 'pijo']);

    const [first, second] = game.bosses;
    while (!first!.isDead) first!.hit();
    game.step(fakeInput());
    expect(game.bosses).toEqual([second]);
    expect(game.status).toBe('running');

    while (!second!.isDead) second!.hit();
    game.step(fakeInput());
    expect(game.status).toBe('victory');
    expect(game.points).toBe(2 * BOSS_POINTS.pijo);
    expect(onVictory).toHaveBeenCalledTimes(1);
  });

  it('los pijos lanzan botellas que van a por el jugador', () => {
    const game = session(4, { modifiers: withModifiers({ invincible: true }) });
    game.kills = getLevel(4).killsToComplete;
    game.backgroundDistance = getLevel(4).distanceToComplete;
    // Antes de que la botella llegue al jugador (y se rompa contra él)
    let thrown = false;
    for (let i = 0; i < BOSS_ENTRY_STEPS + BOSS.pijo.burstPause * 2 && !thrown; i++) {
      game.step(fakeInput());
      thrown = game.enemies.some((enemy) => enemy.thrown);
    }
    expect(thrown).toBe(true);
  });
});
