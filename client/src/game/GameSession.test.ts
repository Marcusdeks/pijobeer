/**
 * Tests de la partida: aparición de enemigos, victoria, jefes, latas, pausa, trucos y
 * cada nivel con algo propio (el 4, el 5 y el 6, dentro del ayuntamiento).
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
  CITY_HALL,
  ENEMY,
  ENEMY_BULLET,
  ENEMY_TYPES,
  FINALE,
  JACKET,
  PICKUP,
  PICKUP_TYPES,
  PLAYER,
  PLAYER_BULLET,
} from './config';
import type { Boss } from './entities/Boss';
import { Bullet } from './entities/Bullet';
import { Enemy } from './entities/Enemy';
import { Pickup } from './entities/Pickup';
import { Player } from './entities/Player';
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
    run(game, game.rules.spawnInterval! * 3);
    expect(game.enemies).toHaveLength(3);
  });

  it('del nivel 1 al 3, cada uno saca botellas más a menudo y más rápidas que el anterior', () => {
    const [l1, l2, l3] = [1, 2, 3].map((id) => session(id).rules);
    expect(l2!.spawnInterval!).toBeLessThan(l1!.spawnInterval!);
    expect(l3!.spawnInterval!).toBeLessThan(l2!.spawnInterval!);
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

  it('el marcador solo enseña cuántas hay que eliminar en el nivel 1 (o si un admin lo fija)', () => {
    expect(session(1).rules.killGoal).toBe(getLevel(1).killsToComplete);
    for (const level of [2, 3, 4, 5]) expect(session(level).rules.killGoal).toBeNull();
    expect(session(3, { modifiers: withModifiers({ killsToComplete: 5 }) }).rules.killGoal).toBe(5);
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
    const onVictory = vi.fn();
    const game = session(2, { events: { onVictory } });
    game.kills = getLevel(2).killsToComplete;
    game.backgroundDistance = getLevel(2).distanceToComplete;
    run(game, BOSS_ENTRY_STEPS);
    return { game, boss: game.bosses[0]!, onVictory };
  }

  it('al cumplir el objetivo entra el jefe (sin ganar aún)', () => {
    const { game, boss, onVictory } = bossFight();
    expect(game.bosses).toHaveLength(1);
    expect(boss.id).toBe('wood');
    expect(onVictory).not.toHaveBeenCalled();
  });

  it('durante el combate dejan de caer botellas (el nivel 2 no tiene enemigos de combate)', () => {
    const { game } = bossFight();
    game.enemies = [];
    for (let i = 0; i < getLevel(2).spawnInterval! * 3; i++) {
      // Sin balas del jefe: aquí solo se cuentan las botellas, no se busca morir
      game.enemyBullets = [];
      game.step(fakeInput());
    }
    expect(game.enemies).toHaveLength(0);
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
    expect(hard.spawnInterval!).toBeLessThan(easy.spawnInterval!);
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

  it('en el nivel 3 solo sirve contra el jefe: antes, la B no hace nada', () => {
    const game = session(3);
    addFoamOnPlayer(game);
    game.step(fakeInput('shield'));
    expect(game.player.isShielding).toBe(false);
    expect(game.player.health).toBe(PLAYER.maxHealth - ENEMY.bulletDamage);

    game.kills = getLevel(3).killsToComplete;
    game.backgroundDistance = getLevel(3).distanceToComplete;
    game.step(fakeInput()); // entra el jefe
    expect(game.jacketAllowed).toBe(true);
    game.step(fakeInput('shield'));
    expect(game.player.isShielding).toBe(true);
  });

  it('en el nivel 4, manteniendo la B, para la espuma; al tercer chorro seguido se empapa', () => {
    const game = session(4);
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

describe('nivel 5', () => {
  /** Nivel 5 con el primo ya en su sitio (la calle recorrida y los barriles eliminados). */
  function atPrimo(options: Partial<GameSessionOptions> = {}) {
    const game = session(5, { modifiers: withModifiers({ invincible: true }), ...options });
    game.kills = getLevel(5).killsToComplete;
    game.backgroundDistance = getLevel(5).distanceToComplete;
    run(game, BOSS_ENTRY_STEPS);
    return game;
  }

  it('solo salen barriles: de madera y de hierro', () => {
    const { pickEnemyType } = session(5).rules;
    const rolls = 100;
    const types = new Set(Array.from({ length: rolls }, (_, i) => pickEnemyType(() => i / rolls)));
    expect(types).toEqual(new Set(['woodBarrel', 'ironBarrel']));
  });

  it('la calle tiene final: el callejón deja de avanzar al llegar al ayuntamiento', () => {
    const game = session(5, { modifiers: withModifiers({ invincible: true }) });
    const end = game.rules.cameraEnd!;
    expect(end).toBe(getLevel(5).distanceToComplete);
    game.backgroundDistance = end - 1;
    run(game, 30, fakeInput('up'));
    expect(game.backgroundDistance).toBe(end);
    expect(game.player.isAdvancing).toBe(false);
    // Los otros niveles no tienen final
    expect(session(4).rules.cameraEnd).toBeNull();
  });

  it('si un admin fija los enemigos, al salir el jefe se salta al final de la calle', () => {
    const game = session(5, { modifiers: withModifiers({ killsToComplete: 1, invincible: true }) });
    addSureKill(game);
    run(game, 2);
    expect(game.bosses.map((boss) => boss.id)).toEqual(['primo']);
    expect(game.backgroundDistance).toBe(game.rules.cameraEnd);
  });

  it('el primo lanza barriles hacia el jugador', () => {
    const game = atPrimo();
    let thrown: Enemy[] = [];
    for (let i = 0; i < BOSS.primo.burstPause * 2 && !thrown.length; i++) {
      game.step(fakeInput('left'));
      thrown = game.enemies.filter((enemy) => enemy.thrown);
    }
    expect(thrown).toHaveLength(1);
    expect(['woodBarrel', 'ironBarrel']).toContain(thrown[0]!.type);
  });

  it('al derrotarlo, la cámara sube, entra solo en el ayuntamiento, desaparece, funde a negro y se gana', () => {
    const onVictory = vi.fn();
    const game = atPrimo({ events: { onVictory } });
    game.enemies.push(new Enemy(300, 300, 'woodBarrel', fixedRandom));
    for (const boss of game.bosses) while (!boss.isDead) boss.hit();
    game.step(fakeInput());
    // Ya no queda nada que pueda hacerle daño mientras entra
    expect(game.enemies).toHaveLength(0);
    expect(game.status).toBe('running');
    expect(onVictory).not.toHaveBeenCalled();

    // Durante el combate la puerta queda por encima de la pantalla; al subir la cámara, a la vista
    const { door, reveal } = game.rules.exit!;
    expect(door.y).toBeLessThan(0);
    expect(door.y + reveal).toBeGreaterThan(0);
    const feet = () => ({
      x: game.player.x + game.player.width / 2,
      y: game.player.y + game.player.height,
    });

    // Entra solo (lo que se pulse no cuenta): primero llega a la puerta, a la vista
    let steps = 0;
    while (feet().y !== door.y + reveal && steps++ < 1000) game.step(fakeInput('down', 'shoot'));
    expect(feet().x).toBeCloseTo(door.x);
    expect(game.backgroundDistance).toBe(game.rules.cameraEnd! + reveal);
    expect(game.playerFade).toBe(0);

    // Después desaparece en lo oscuro y la pantalla funde a negro; solo al final, la victoria
    const fades: Array<[number, number]> = [];
    while (game.status === 'running' && steps++ < 1000) {
      game.step(fakeInput('down', 'shoot'));
      fades.push([game.playerFade, game.screenFade]);
    }
    expect(game.status).toBe('victory');
    expect(onVictory).toHaveBeenCalledTimes(1);
    expect(feet().y).toBe(door.y + reveal - FINALE.vanishDistance);
    // La pantalla no empieza a fundirse hasta que él ha desaparecido del todo
    for (const [player, screen] of fades) if (screen > 0) expect(player).toBe(1);
    expect(fades.at(-1)).toEqual([1, 1]);
    expect(game.playerBullets).toHaveLength(0);
    expect(game.points).toBe(BOSS_POINTS.primo);
  });

  it('el primo no llega nunca al camión: se mueve solo a su izquierda', () => {
    const game = atPrimo();
    let rightmost = 0;
    for (let i = 0; i < 2000; i++) {
      game.step(fakeInput());
      for (const boss of game.bosses) rightmost = Math.max(rightmost, boss.x + boss.width);
    }
    expect(rightmost).toBeLessThanOrEqual(FINALE.truck.x - FINALE.truckGap);
  });

  it('no pide un mínimo de barriles: el jefe sale al acabar la calle', () => {
    const game = session(5, { modifiers: withModifiers({ invincible: true }) });
    game.backgroundDistance = getLevel(5).distanceToComplete;
    run(game, 2);
    expect(game.kills).toBe(0);
    expect(game.bosses.map((boss) => boss.id)).toEqual(['primo']);
  });

  it('con texto tras el jefe, primero el texto y después entra en el ayuntamiento', () => {
    const onDialog = vi.fn();
    const game = atPrimo({ dialogs: ['afterBosses'], events: { onDialog } });
    for (const boss of game.bosses) while (!boss.isDead) boss.hit();
    game.step(fakeInput());
    expect(game.status).toBe('dialog');
    const before = { x: game.player.x, y: game.player.y };

    game.closeDialog();
    run(game, 5);
    expect(game.status).toBe('running');
    expect([game.player.x, game.player.y]).not.toEqual([before.x, before.y]);
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

  it('contra los pijos siguen llegando barriles pequeños (y nada más)', () => {
    const game = session(4, { modifiers: withModifiers({ invincible: true }) });
    game.kills = getLevel(4).killsToComplete;
    game.backgroundDistance = getLevel(4).distanceToComplete;
    game.step(fakeInput()); // entran los pijos
    const interval = game.rules.bossFightEnemy!.spawnInterval;
    const spawned: string[] = [];
    for (let i = 0; i < interval * 2; i++) {
      const before = new Set(game.enemies);
      game.step(fakeInput('left'));
      for (const enemy of game.enemies)
        if (!before.has(enemy) && !enemy.thrown) spawned.push(enemy.type);
    }
    expect(spawned).toEqual(['barrel', 'barrel']);
  });

  it('al derrotar a los pijos, la partida se para con su texto y la victoria llega al cerrarlo', () => {
    const onDialog = vi.fn();
    const onVictory = vi.fn();
    const game = session(4, {
      dialogs: ['afterBosses'],
      events: { onDialog, onVictory },
      modifiers: withModifiers({ invincible: true }),
    });
    game.kills = getLevel(4).killsToComplete;
    game.backgroundDistance = getLevel(4).distanceToComplete;
    run(game, BOSS_ENTRY_STEPS);
    for (const boss of game.bosses) while (!boss.isDead) boss.hit();
    game.step(fakeInput());
    expect(game.status).toBe('dialog');
    expect(onDialog).toHaveBeenCalledWith('afterBosses');
    expect(onVictory).not.toHaveBeenCalled();

    game.closeDialog();
    game.step(fakeInput());
    expect(game.status).toBe('victory');
    expect(onVictory).toHaveBeenCalledTimes(1);
  });

  it('los pijos se turnan también con furia: nunca lanzan a la vez', () => {
    const game = session(4, { modifiers: withModifiers({ invincible: true }) });
    game.kills = getLevel(4).killsToComplete;
    game.backgroundDistance = getLevel(4).distanceToComplete;
    run(game, BOSS_ENTRY_STEPS);
    // Con furia los dos tienen la misma pausa: es cuando antes se sincronizaban
    for (const boss of game.bosses) while (!boss.isEnraged) boss.hit();

    const throwSteps: number[] = [];
    for (let step = 0; step < 900; step++) {
      const before = new Set(game.enemies);
      game.step(fakeInput('left'));
      const thrown = game.enemies.filter((enemy) => !before.has(enemy) && enemy.thrown).length;
      expect(thrown).toBeLessThanOrEqual(1);
      if (thrown > 0) throwSteps.push(step);
    }
    const gaps = throwSteps.slice(1).map((step, i) => step - throwSteps[i]!);
    const enragedPause = Math.round(BOSS.pijo.burstPause * BOSS.pijo.enragedPauseScale);
    expect(throwSteps.length).toBeGreaterThan(10);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(Math.round(enragedPause / 2));
  });

  it('los pijos lanzan botellas hacia el jugador', () => {
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

describe('nivel 6', () => {
  const hall = CITY_HALL.hall;
  const { office } = CITY_HALL;

  /** Un abrechapas encima de cada segurata en cada paso, hasta acabar con los cuatro. */
  function clearHall(game: GameSession) {
    for (let i = 0; i < 200 && game.kills < hall.guards.length; i++) {
      for (const enemy of game.enemies) {
        const x = enemy.x + enemy.width / 2 - PLAYER_BULLET.width / 2;
        game.playerBullets.push(new Bullet(x, enemy.y + enemy.height / 2, 0, PLAYER_BULLET));
      }
      game.step(fakeInput());
    }
  }

  /** Nivel 6 ya en el despacho, con la sala a la vista y el alcalde ya delante de su mesa. */
  function inOffice(options: Partial<GameSessionOptions> = {}) {
    const game = session(6, { modifiers: withModifiers({ invincible: true }), ...options });
    clearHall(game);
    const ready = () =>
      game.room === 'office' &&
      game.screenFade === 0 &&
      game.bosses.every((boss) => !boss.isEntering);
    for (let i = 0; i < 3000 && !ready(); i++) {
      game.step(fakeInput());
      if (game.status === 'dialog') game.closeDialog();
    }
    return game;
  }

  const byId = (game: GameSession, id: string) => game.bosses.find((boss) => boss.id === id)!;

  /** Un abrechapas que da de lleno a un jefe en el siguiente paso. */
  function shoot(game: GameSession, boss: Boss) {
    const x = boss.x + boss.width / 2 - PLAYER_BULLET.width / 2;
    game.playerBullets.push(new Bullet(x, boss.y + boss.height / 2, 0, PLAYER_BULLET));
  }

  it('empieza en la planta baja: cuatro seguratas quietos en su sitio, nada que caiga y tres chicas bailando', () => {
    const game = session(6);
    expect(game.room).toBe('hall');
    expect(game.field).toEqual(hall.field);
    expect(game.enemies.map((enemy) => enemy.type)).toEqual(hall.guards.map(() => 'guard'));
    expect(game.dancers.map((dancer) => dancer.action)).toEqual(['dance', 'dance', 'dance']);
    const where = () => game.enemies.map((enemy) => [enemy.x, enemy.y]);
    const before = where();

    // Antes de la alarma: ni cae nada, ni disparan, ni se avanza aunque se pulse W
    run(game, hall.alarmSteps - 1, fakeInput('up'));
    expect(where()).toEqual(before);
    expect(game.enemies).toHaveLength(hall.guards.length);
    expect(game.enemyBullets).toHaveLength(0);
    expect(game.backgroundDistance).toBe(0);
    expect(game.dancers.every((dancer) => dancer.action === 'dance')).toBe(true);
    expect(game.dancers.some((dancer) => dancer.isShouting)).toBe(false);
  });

  it('al primer disparo salta la alarma: las chicas gritan y huyen, y los seguratas disparan', () => {
    const game = session(6, { modifiers: withModifiers({ invincible: true }) });
    game.step(fakeInput('shoot'));
    expect(game.dancers.every((dancer) => dancer.action === 'scared')).toBe(true);
    expect(game.dancers.every((dancer) => dancer.isShouting)).toBe(true);

    run(game, CITY_HALL.dancer.scaredSteps);
    expect(game.dancers.every((dancer) => dancer.action === 'run')).toBe(true);
    let shots = 0;
    for (let i = 0; i < 600 && game.dancers.length > 0; i++) {
      game.step(fakeInput());
      shots += game.enemyBullets.length;
    }
    // Llegan a su salida, desaparecen y se retiran
    expect(game.dancers).toHaveLength(0);
    expect(shots).toBeGreaterThan(0);
  });

  it('la chica 3 sale por la puerta del lateral: se abre al llegar ella y se cierra después', () => {
    const game = session(6);
    game.step(fakeInput('shoot'));
    const girl = game.dancers.find((dancer) => dancer.girl === 3)!;
    expect(girl.viaDoor).toBe(true);
    const opening: number[] = [];
    for (let i = 0; i < 600 && game.dancers.includes(girl); i++) {
      game.step(fakeInput());
      opening.push(girl.doorOpen);
    }
    expect(game.dancers).not.toContain(girl);
    // Cerrada mientras se asusta, se abre del todo, y vuelve a cerrarse antes de retirarla
    expect(opening[0]).toBe(0);
    expect(Math.max(...opening)).toBe(1);
    expect(opening.at(-1)).toBeLessThan(0.1);
    // Las demás no tienen puerta
    expect(game.dancers.every((dancer) => dancer.doorOpen === 0)).toBe(true);
  });

  it('si no dispara, la alarma salta sola a los 3 s', () => {
    const game = session(6);
    run(game, hall.alarmSteps - 1);
    expect(game.dancers[0]!.action).toBe('dance');
    run(game, 1);
    expect(game.dancers[0]!.action).toBe('scared');
  });

  it('los seguratas no mueren de un choque: hay que acabar con ellos a abrechapas', () => {
    const game = session(6, { modifiers: withModifiers({ invincible: true }) });
    const [guard] = game.enemies;
    game.player.x = guard!.x;
    game.player.y = guard!.y;
    game.step(fakeInput());
    expect(guard!.alive).toBe(true);
    expect(game.kills).toBe(0);
  });

  it('sin seguratas, sube solo por la escalera y aparece en el despacho, con los jefes esperando', () => {
    const game = session(6, { modifiers: withModifiers({ invincible: true }) });
    clearHall(game);
    expect(game.points).toBe(hall.guards.length * ENEMY_POINTS.guard);

    // Sube solo hasta lo alto de la escalera (lo que se pulse no cuenta) y desaparece
    let steps = 0;
    while (game.room === 'hall' && steps++ < 2000) game.step(fakeInput('down', 'shoot'));
    expect(game.room).toBe('office');
    expect(game.partyOver).toBe(true);
    expect(game.playerBullets).toHaveLength(0);
    // Llega con la pantalla en negro, abajo, en la entrada
    expect(game.screenFade).toBe(1);
    expect(game.field).toEqual(office.field);
    const start = Player.spawn();
    expect([game.player.x, game.player.y]).toEqual([start.x, start.y]);

    // Las chicas, ya en su puesto; el alcalde, detrás de su mesa
    expect(game.bosses.map((boss) => boss.id)).toEqual(['mayor', 'blonde', 'redhead']);
    for (const id of ['blonde', 'redhead'] as const) {
      const boss = byId(game, id);
      expect(boss.isEntering).toBe(false);
      expect(boss.feet.y).toBe(office.posts[id]!.feetY);
    }
    const mayor = byId(game, 'mayor');
    expect(mayor.isEntering).toBe(true);
    expect(mayor.feet).toEqual(office.posts.mayor!.from);

    // La sala se ve poco a poco y, mientras, nada se mueve
    run(game, FINALE.fadeSteps - 1);
    expect(game.screenFade).toBeGreaterThan(0);
    expect(mayor.feet).toEqual(office.posts.mayor!.from);
    run(game, 1);
    expect(game.screenFade).toBe(0);
  });

  it('el alcalde sale de detrás de la mesa y se pone delante; mientras, no se le puede dañar', () => {
    const game = session(6, { modifiers: withModifiers({ invincible: true }) });
    clearHall(game);
    for (let i = 0; i < 2000 && (game.room !== 'office' || game.screenFade > 0); i++) {
      game.step(fakeInput());
    }
    const mayor = byId(game, 'mayor');
    const { desk } = office;
    let leftDesk = false;
    for (let i = 0; i < 1000 && mayor.isEntering; i++) {
      shoot(game, mayor);
      game.step(fakeInput());
      // Por detrás de la mesa solo pasa mientras está a su altura: sale por un lado, no la atraviesa
      if (mayor.feet.y > desk.back) leftDesk ||= mayor.x >= desk.right;
      if (mayor.feet.y > desk.back && mayor.feet.y < desk.front) {
        expect(mayor.x >= desk.right || mayor.x + mayor.width <= desk.left).toBe(true);
      }
    }
    expect(leftDesk).toBe(true);
    expect(mayor.isEntering).toBe(false);
    expect(mayor.feet.y).toBe(office.posts.mayor!.feetY);
    expect(mayor.feet.y).toBeGreaterThan(desk.front);
    // Como mucho, el abrechapas que le llega justo en el paso en que acaba de colocarse
    expect(mayor.health).toBeGreaterThanOrEqual(mayor.maxHealth - PLAYER_BULLET.damage);
  });

  it('con texto antes de los jefes, sale al acabar de verse el despacho (y no al subir)', () => {
    const onDialog = vi.fn();
    const game = session(6, {
      modifiers: withModifiers({ invincible: true }),
      dialogs: ['beforeBosses'],
      events: { onDialog },
    });
    clearHall(game);
    for (let i = 0; i < 2000 && game.status === 'running'; i++) game.step(fakeInput());
    expect(game.status).toBe('dialog');
    expect(onDialog).toHaveBeenCalledWith('beforeBosses');
    expect(game.room).toBe('office');
    expect(game.screenFade).toBe(0);
  });

  it('mientras vivan sus chicas, al alcalde no se le puede bajar de 1 de vida y ellas le curan', () => {
    const game = inOffice();
    const mayor = byId(game, 'mayor');
    for (let i = 0; i < 200; i++) {
      shoot(game, mayor);
      game.step(fakeInput());
    }
    expect(mayor.health).toBeGreaterThanOrEqual(1);
    expect(game.bosses).toContain(mayor);

    // Sin dispararle, las chicas le lanzan cerveza y le curan
    const hurt = mayor.health;
    let thrown = 0;
    for (let i = 0; i < office.heal.gap * 3; i++) {
      game.step(fakeInput());
      thrown = Math.max(thrown, game.heals.length);
    }
    expect(thrown).toBeGreaterThan(0);
    expect(mayor.health).toBeGreaterThan(hurt);
  });

  it('la cerveza que le cura se puede romper de un abrechapas', () => {
    const game = inOffice();
    const mayor = byId(game, 'mayor');
    mayor.hit(PLAYER_BULLET.damage * 10, 1);
    const hurt = mayor.health;
    for (let i = 0; i < office.heal.gap * 3; i++) {
      for (const heal of game.heals) {
        const x = heal.x + heal.width / 2 - PLAYER_BULLET.width / 2;
        game.playerBullets.push(new Bullet(x, heal.y + heal.height / 2, 0, PLAYER_BULLET));
      }
      game.step(fakeInput());
    }
    expect(mayor.health).toBe(hurt);
  });

  it('sin sus chicas, el alcalde ya puede caer; ni ellas ni él se enfurecen', () => {
    const game = inOffice();
    for (const id of ['blonde', 'redhead'] as const) {
      const girl = byId(game, id);
      while (girl.health > PLAYER_BULLET.damage) girl.hit();
      expect(girl.isEnraged).toBe(false);
      shoot(game, girl);
      game.step(fakeInput());
    }
    expect(game.bosses.map((boss) => boss.id)).toEqual(['mayor']);
    const mayor = byId(game, 'mayor');
    while (mayor.health > PLAYER_BULLET.damage) mayor.hit();
    expect(mayor.isEnraged).toBe(false);
    shoot(game, mayor);
    game.step(fakeInput());
    expect(game.bosses).toHaveLength(0);
  });

  it('los jefes del despacho lanzan botellas por turnos y no salen de su puesto', () => {
    const game = inOffice();
    const throwers = new Set<string>();
    for (let i = 0; i < 1500; i++) {
      const before = game.enemies.filter((enemy) => enemy.thrown).length;
      game.step(fakeInput());
      const thrown = game.enemies.filter((enemy) => enemy.thrown);
      // Nunca dos a la vez: como mucho, una botella nueva por paso
      expect(thrown.length - before).toBeLessThanOrEqual(1);
      for (const boss of game.bosses) {
        const { field } = office.posts[boss.id]!;
        expect(boss.x).toBeGreaterThanOrEqual(field.left);
        expect(boss.x + boss.width).toBeLessThanOrEqual(field.right);
        if (boss.pose.action === 'recover') throwers.add(boss.id);
      }
      game.enemies = game.enemies.filter((enemy) => !enemy.thrown);
    }
    expect([...throwers].sort()).toEqual(['blonde', 'mayor', 'redhead']);
  });

  it('al derrotarlos: su texto, pantalla negra, de vuelta en la planta baja, el último texto y la victoria', () => {
    const onVictory = vi.fn();
    const onDialog = vi.fn();
    const game = inOffice({
      dialogs: ['afterBosses', 'epilogue'],
      events: { onVictory, onDialog },
    });
    for (const boss of game.bosses) while (!boss.isDead) boss.hit();
    game.step(fakeInput());
    expect(game.status).toBe('dialog');
    expect(onDialog).toHaveBeenLastCalledWith('afterBosses');
    game.closeDialog();

    // Funde a negro en el despacho (empieza en el paso siguiente a cerrar el texto)...
    run(game, FINALE.fadeSteps);
    expect(game.room).toBe('office');
    expect(game.screenFade).toBeGreaterThan(0.9);
    // ...y aparece abajo, en la planta baja vacía y sin fiesta, mientras vuelve a verse
    run(game, 1);
    expect(game.room).toBe('hall');
    expect(game.screenFade).toBe(1);
    expect(game.partyOver).toBe(true);
    expect([game.enemies, game.dancers, game.bosses]).toEqual([[], [], []]);
    run(game, FINALE.fadeSteps);
    expect(game.screenFade).toBe(0);

    // El último texto y, al cerrarlo, la victoria
    game.step(fakeInput());
    expect(onDialog).toHaveBeenLastCalledWith('epilogue');
    expect(onVictory).not.toHaveBeenCalled();
    game.closeDialog();
    game.step(fakeInput());
    expect(game.status).toBe('victory');
    expect(onVictory).toHaveBeenCalledTimes(1);
    const bosses = BOSS_POINTS.mayor + BOSS_POINTS.blonde + BOSS_POINTS.redhead;
    expect(game.points).toBe(hall.guards.length * ENEMY_POINTS.guard + bosses);
  });
});

describe('ritmo de disparo del jugador', () => {
  it('desde el nivel 5 dispara más que antes (en cualquier dificultad)', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const cooldown = (levelId: number) => session(levelId, { difficulty }).rules.shootCooldown;
      expect(cooldown(5)).toBeLessThan(cooldown(4));
      expect(cooldown(6)).toBe(cooldown(5));
      expect(cooldown(4)).toBe(cooldown(1));
    }
  });
});
