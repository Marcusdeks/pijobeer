/**
 * PARTIDA: el estado y las reglas de una partida, de principio a fin.
 *
 * Es el corazón del motor. Cada llamada a step() avanza el mundo exactamente
 * UN paso (1/60 s): mover, hacer aparecer enemigos, resolver colisiones,
 * retirar lo que sobra y comprobar si la partida ha terminado.
 *
 * Estados:   running ⇄ paused     running ⇄ dialog     running ─► victory     running ─► over
 * ("victory" y "over" son finales: la partida ya no avanza. En "dialog" la
 * partida está parada mientras React enseña un texto: ver DialogMoment.)
 *
 * Calles con final (nivel 5, la del ayuntamiento): el callejón deja de
 * avanzar al llegar al final (rules.cameraEnd) y, al derrotar al jefe, el
 * protagonista entra solo en el edificio (rules.exit): la cámara sube hasta
 * ver la puerta mientras él anda hacia ella, desaparece en lo oscuro y la
 * pantalla funde a negro; entonces, la victoria.
 * Mientras entra no hay enemigos, ni se le puede manejar.
 *
 * Dentro del ayuntamiento (nivel 6) no hay callejón sino SALAS fijas (room,
 * ver CITY_HALL en config.ts). En la planta baja hay fiesta: los seguratas ya
 * están colocados y no cae nada. Al primer disparo salta la alarma (las chicas
 * huyen y los seguratas disparan). Eliminados los seguratas, el protagonista
 * sube solo por la escalera, como al entrar en el ayuntamiento, pero al fundir
 * a negro aparece en el despacho (la pantalla vuelve a verse poco a poco) y
 * allí esperan los jefes: las chicas y el alcalde, que no puede morir mientras
 * ellas vivan y al que curan lanzándole cerveza (heals). Al derrotarlos, la
 * pantalla funde a negro y el protagonista aparece en la planta baja, ya sin
 * fiesta, para su último texto (epilogue); después, la victoria.
 *
 * Latas: cada cierto tiempo (según la dificultad) cae una lata. La verde
 * cura y la de leopardo acelera al jugador durante unos segundos.
 *
 * Cómo se supera un nivel (además hay que recorrer el callejón que pida el nivel):
 *   - Sin jefe: eliminando las botellas que piden las reglas.
 *   - Con jefes: al eliminarlas entran los jefes del nivel (en el 4, dos a la
 *     vez) y dejan de caer botellas (en el 4 siguen llegando barriles
 *     pequeños: bossFightEnemy); se gana al derrotarlos.
 *
 * No dibuja nada (eso es renderer.ts) ni sabe de React. Avisa de lo que pasa
 * con eventos (callbacks), y React decide qué menús enseñar o qué guardar.
 */
import {
  BOSS_POINTS,
  ENEMY_POINTS,
  POINTS_PER_KILL,
  type BossId,
  type DifficultyId,
  type EnemyTypeId,
  type GameModifiers,
} from '@pijobeer/shared';
import {
  ARENA,
  BOSS,
  BOSS_COMMON,
  CITY_HALL,
  ENEMY,
  FINALE,
  PICKUP,
  PLAYER_BULLET,
  type HallDancer,
  type PickupTypeId,
} from './config';
import { Boss } from './entities/Boss';
import type { Bullet } from './entities/Bullet';
import { Dancer } from './entities/Dancer';
import { Enemy, type RandomFn } from './entities/Enemy';
import { HealingBeer } from './entities/HealingBeer';
import { Pickup } from './entities/Pickup';
import { Player } from './entities/Player';
import { clamp, intersects, type Point } from './geometry';
import type { InputState } from './input/InputState';
import type { Playfield } from './playfield';
import { resolveRules, type GameRules } from './rules';

export type GameStatus = 'running' | 'paused' | 'dialog' | 'victory' | 'over';

/** Salas del ayuntamiento (nivel 6): la planta baja y el despacho del alcalde. */
export type RoomId = 'hall' | 'office';

/** Pasos que tarda el protagonista en desaparecer en lo oscuro de la puerta (ver FINALE). */
const VANISH_STEPS = Math.ceil(FINALE.vanishDistance / FINALE.exitSpeed);

/**
 * Momentos en los que la partida se puede parar para enseñar un texto:
 *   opening       nada más empezar
 *   beforeBosses  justo antes de que entren los jefes (en el ayuntamiento, al llegar al despacho)
 *   afterBosses   al derrotarlos, antes de dar la victoria
 *   epilogue      en el ayuntamiento, de vuelta en la planta baja, justo antes de la victoria
 * Qué texto sale (y si sale) lo decide React; el motor solo se para y avisa.
 */
export type DialogMoment = 'opening' | 'beforeBosses' | 'afterBosses' | 'epilogue';

/**
 * Escena de puerta: el protagonista va solo hasta `door` (en pantalla, con la
 * cámara aún sin subir), mientras la cámara sube `reveal` píxeles, y entra.
 * Ya dentro, con la pantalla en negro, pasa `next`: la victoria o, en la
 * planta baja del ayuntamiento, la llegada al despacho.
 */
interface Doorway {
  door: Point;
  reveal: number;
  next: 'victory' | 'office';
}

export interface GameResult {
  level: number;
  kills: number;
  points: number;
}

export interface GameEvents {
  /** Cambio de estado (para enseñar u ocultar los menús de pausa y victoria). */
  onStatusChange?: (status: GameStatus) => void;
  /** La partida se ha parado para enseñar un texto; sigue al llamar a closeDialog(). */
  onDialog?: (moment: DialogMoment) => void;
  /** Nivel superado. Solo se emite una vez. */
  onVictory?: (result: GameResult) => void;
  /** Sin vida. Solo se emite una vez. */
  onGameOver?: (result: GameResult) => void;
}

export interface GameSessionOptions {
  levelId: number;
  /** Trucos de administrador (por defecto, ninguno). */
  modifiers?: GameModifiers;
  /** Dificultad elegida en el menú (por defecto, normal). */
  difficulty?: DifficultyId;
  /** En qué momentos parar la partida para enseñar un texto (por defecto, en ninguno). */
  dialogs?: readonly DialogMoment[];
  events?: GameEvents;
  /** Generador aleatorio. Por defecto Math.random; los tests pasan uno predecible. */
  random?: RandomFn;
}

/** Lo que tienen en común botellas, latas y balas para poder retirarlas al final del paso. */
interface Removable {
  alive: boolean;
  isOutOfBounds(arenaHeight: number): boolean;
}
const isStillInPlay = (item: Removable) => item.alive && !item.isOutOfBounds(ARENA.height);

/**
 * Los jefes que protegen a uno (BOSS[id].guardedBy), con el tipo general: con
 * "as const", el de quien no tiene protectores sería una lista vacía exacta.
 */
const guardiansOf = (id: BossId): readonly BossId[] => BOSS[id].guardedBy;

export class GameSession {
  readonly rules: GameRules;
  readonly player = Player.spawn();
  enemies: Enemy[] = [];
  playerBullets: Bullet[] = [];
  /** Viven aquí y no en cada enemigo: siguen volando aunque su enemigo muera. */
  enemyBullets: Bullet[] = [];
  pickups: Pickup[] = [];
  /** Jefes en pantalla (vacío si aún no han aparecido o el nivel no tiene). */
  bosses: Boss[] = [];
  /** Chicas de la fiesta de la planta baja del ayuntamiento (decorado: no chocan con nada). */
  dancers: Dancer[] = [];
  /** Cervezas que las chicas del despacho le lanzan al alcalde para curarle. */
  heals: HealingBeer[] = [];
  kills = 0;
  /** Pasos jugados (sin contar pausas ni textos). Marca el ritmo de aparición de botellas y latas. */
  steps = 0;
  /** Píxeles que ha avanzado el callejón (ver CAMERA en config.ts). */
  backgroundDistance = 0;
  /** Sala del ayuntamiento en la que se está (null = nivel de calle). */
  room: RoomId | null;
  /** Suelo por el que se mueve todo: el del callejón o el de la sala. */
  field: Playfield;

  private currentStatus: GameStatus = 'running';
  /** Ya han entrado los jefes (aunque luego se les derrote y desaparezcan). */
  private bossesSpawned = false;
  /** Planta baja: ya ha saltado la alarma (ver raiseAlarm). */
  private alarmed = false;
  /** Escena de puerta en curso (ver Doorway), o null si se está jugando. */
  private doorway: Doorway | null = null;
  /** Escena de puerta: cuánto ha subido ya la cámara hacia la puerta. */
  private revealed = 0;
  /** Escena de puerta: ya ha llegado a la puerta, y los pasos que lleva desde entonces. */
  private atDoor = false;
  private insideSteps = 0;
  /** Al llegar a una sala: pasos que le quedan a la pantalla para dejar de estar en negro. */
  private fadeInSteps = 0;
  /** Al acabar con los jefes del despacho: pasos que le quedan a la pantalla para quedarse en negro. */
  private fadeOutSteps = 0;
  /** De vuelta en la planta baja tras vencer: solo queda el último texto y la victoria. */
  private ending = false;
  /** Despacho: pasos hasta la próxima cerveza para el alcalde, y a qué chica le toca lanzarla. */
  private healCooldown: number = CITY_HALL.office.heal.gap;
  private healTurn = 0;
  /** Puntos de los enemigos eliminados y de los jefes derrotados, sin multiplicar. */
  private earnedPoints = 0;
  private readonly pendingDialogs: Set<DialogMoment>;
  private readonly events: GameEvents;
  private readonly random: RandomFn;

  constructor({
    levelId,
    modifiers,
    difficulty,
    dialogs = [],
    events = {},
    random = Math.random,
  }: GameSessionOptions) {
    this.rules = resolveRules(levelId, modifiers, difficulty);
    this.pendingDialogs = new Set(dialogs);
    this.events = events;
    this.random = random;
    this.field = this.rules.field;
    this.room = this.level.interior ? 'hall' : null;
    if (this.room === 'hall') this.setUpParty();
  }

  get level() {
    return this.rules.level;
  }

  get status(): GameStatus {
    return this.currentStatus;
  }

  /**
   * Puntos de los enemigos eliminados y de los jefes derrotados, por el
   * multiplicador de la dificultad. Se redondea a un múltiplo de
   * POINTS_PER_KILL porque el servidor rechaza cualquier otra cifra.
   */
  get points(): number {
    const raw = this.earnedPoints * this.rules.pointsScale;
    return Math.round(raw / POINTS_PER_KILL) * POINTS_PER_KILL;
  }

  get result(): GameResult {
    return { level: this.level.id, kills: this.kills, points: this.points };
  }

  /** true cuando ya se han eliminado las botellas Y recorrido el callejón que piden las reglas. */
  get waveCompleted(): boolean {
    const { killsToComplete, distanceToComplete } = this.rules;
    return this.kills >= killsToComplete && this.backgroundDistance >= distanceToComplete;
  }

  /** true si el nivel tiene jefes, ya han entrado y no queda ninguno. */
  get bossesDefeated(): boolean {
    return this.bossesSpawned && this.bosses.length === 0;
  }

  /**
   * Escena de puerta: cuánto ha desaparecido el protagonista en lo oscuro de
   * la puerta (0 = se le ve entero, 1 = ya no se le ve) y cuánto se ha fundido
   * la pantalla a negro después (0 = nada, 1 = negra del todo). Al llegar al
   * despacho, la pantalla va del negro a verse otra vez. Los usa el renderer.
   */
  get playerFade(): number {
    return clamp(this.insideSteps / VANISH_STEPS, 0, 1);
  }

  get screenFade(): number {
    if (this.fadeOutSteps > 0) return 1 - this.fadeOutSteps / FINALE.fadeSteps;
    if (this.fadeInSteps > 0) return this.fadeInSteps / FINALE.fadeSteps;
    return clamp((this.insideSteps - VANISH_STEPS) / FINALE.fadeSteps, 0, 1);
  }

  /** Planta baja del ayuntamiento: la fiesta se acaba cuando sube al despacho (y no vuelve). */
  get partyOver(): boolean {
    return this.bossesSpawned;
  }

  /** Si ahora se puede usar la chupa: según el nivel, siempre o solo contra los jefes. */
  get jacketAllowed(): boolean {
    const { jacket } = this.level;
    return jacket === 'always' || (jacket === 'bosses' && this.bossesSpawned);
  }

  pause(): void {
    if (this.currentStatus === 'running') this.setStatus('paused');
  }

  resume(): void {
    if (this.currentStatus === 'paused') this.setStatus('running');
  }

  togglePause(): void {
    if (this.currentStatus === 'running') this.pause();
    else this.resume();
  }

  /** Cierra el texto que estaba enseñando React y la partida sigue. */
  closeDialog(): void {
    if (this.currentStatus === 'dialog') this.setStatus('running');
  }

  /** Avanza la simulación un paso. En pausa, con un texto o terminada, no cambia nada. */
  step(input: InputState): void {
    if (this.currentStatus !== 'running') return;
    if (this.openDialog('opening')) return;
    if (this.fadeOutSteps > 0) return this.fadeOut();
    if (this.fadeInSteps > 0) return this.fadeIn();
    // Ya de vuelta en la planta baja: el último texto (si lo hay) y la victoria
    if (this.ending) return this.openDialog('epilogue') ? undefined : this.win();
    // También cuenta mientras pasa por una puerta: las bolas de discoteca siguen girando
    this.steps++;
    if (this.doorway) return this.walkThroughDoor();

    this.moveEverything(input);
    this.spawn();
    this.spawnPickup();
    this.throwHeals();
    this.resolveCollisions();

    // Limpieza: sin ella las listas crecerían sin parar y el juego iría cada vez más lento
    this.enemies = this.enemies.filter(isStillInPlay);
    this.pickups = this.pickups.filter(isStillInPlay);
    this.playerBullets = this.playerBullets.filter(isStillInPlay);
    this.enemyBullets = this.enemyBullets.filter(isStillInPlay);
    this.heals = this.heals.filter(isStillInPlay);
    this.dancers = this.dancers.filter((dancer) => !dancer.isGone);

    this.checkEnd();
  }

  // ------------------------------------------------------------------

  /**
   * Si hay un texto pendiente para este momento, para la partida y avisa.
   * Cada momento se enseña una sola vez por partida.
   * @returns true si se ha parado
   */
  private openDialog(moment: DialogMoment): boolean {
    if (!this.pendingDialogs.delete(moment)) return false;
    this.setStatus('dialog');
    this.events.onDialog?.(moment);
    return true;
  }

  /**
   * Planta baja del ayuntamiento: los seguratas en su sitio (sin disparar
   * hasta la alarma) y las chicas bailando. Cada uno empieza su baile en un
   * momento distinto, para que no vayan todos a la vez.
   */
  private setUpParty(): void {
    const { guards } = CITY_HALL.hall;
    // Con el tipo general: en la config, con "as const", cada chica tiene el suyo
    // exacto, y solo la que sale por la puerta trae viaDoor
    const dancers: readonly HallDancer[] = CITY_HALL.hall.dancers;
    const offset = (index: number) => index * 5;
    this.enemies = guards.map(({ look, x, y }, index) =>
      Enemy.placed('guard', { x, y }, look, this.random, offset(index)),
    );
    this.dancers = dancers.map(
      ({ girl, x, y, exit, viaDoor }, index) =>
        new Dancer(girl, x, y, exit, viaDoor, offset(index + 2)),
    );
  }

  /** Salta la alarma (una vez): las chicas huyen y los seguratas empiezan a disparar. */
  private raiseAlarm(): void {
    if (this.alarmed) return;
    this.alarmed = true;
    for (const dancer of this.dancers) dancer.scare();
    for (const enemy of this.enemies) if (enemy.placed) enemy.arm();
  }

  private moveEverything(input: InputState): void {
    const { player, rules } = this;
    // En una calle con final, el callejón no pasa de él
    const roadLeft =
      rules.cameraEnd === null ? Infinity : rules.cameraEnd - this.backgroundDistance;
    const shot = player.update(input, {
      field: this.field,
      shootCooldown: rules.shootCooldown,
      // Contra los jefes no se avanza (el combate es en el sitio), ni dentro de una sala
      canAdvance: this.room === null && !this.bossesSpawned && roadLeft > 0,
      jacketAllowed: this.jacketAllowed,
    });
    if (shot) this.playerBullets.push(shot);
    const advance = Math.min(player.advanceSpeed, roadLeft);
    this.backgroundDistance += advance;

    // La fiesta de la planta baja se acaba al primer disparo, o sola al rato
    if (this.room === 'hall' && (shot || this.steps >= CITY_HALL.hall.alarmSteps)) {
      this.raiseAlarm();
    }
    for (const dancer of this.dancers) dancer.update();

    // Barriles, jefes y botellas lanzadas apuntan al centro del jugador
    const target = { x: player.x + player.width / 2, y: player.y + player.height / 2 };
    for (const enemy of this.enemies) this.enemyBullets.push(...enemy.update(target));
    this.bosses.forEach((boss, index) => {
      const { bullets, bottles } = boss.update(target);
      this.enemyBullets.push(...bullets);
      this.enemies.push(...bottles);
      if (bullets.length === 0 && bottles.length === 0) return;
      // Por turnos: quien ataca hace esperar a los demás (ver Boss.waitTurn). Los
      // que aún no se han movido en este paso descontarán uno al hacerlo: con +1
      // esperan lo mismo que el resto, y nunca atacan en el mismo paso
      this.bosses.forEach((other, otherIndex) => {
        if (other !== boss) other.waitTurn(boss.turnGap + (otherIndex > index ? 1 : 0));
      });
    });

    for (const pickup of this.pickups) pickup.update();
    for (const heal of this.heals) heal.update();
    for (const bullet of this.playerBullets) bullet.update();
    for (const bullet of this.enemyBullets) bullet.update();

    // Al avanzar, lo que viene hacia el jugador se le acerca además a la velocidad
    // del callejón: así nunca parece quieto (o que se aleja) cuando el suelo
    // corre más que su caída. Parado, cada cosa cae a su propio ritmo. Sus
    // propios abrechapas no: van por delante de él a su velocidad de siempre.
    for (const thing of [...this.enemies, ...this.pickups, ...this.enemyBullets])
      thing.y += advance;
  }

  /**
   * Botellas al ritmo del nivel (si es que caen). Cumplido el objetivo de un
   * nivel con jefes, llegan los jefes (ver callBosses) y dejan de caer
   * botellas: el combate es contra ellos, lo que lancen y, si el nivel lo
   * pide (bossFightEnemy), algún enemigo suelto de un tipo concreto.
   */
  private spawn(): void {
    const { level, spawnInterval, bossFightEnemy } = this.rules;

    if (level.bosses.length > 0 && this.waveCompleted) {
      if (!this.bossesSpawned) this.callBosses();
      if (this.bossesSpawned && bossFightEnemy && this.steps % bossFightEnemy.spawnInterval === 0) {
        this.spawnEnemy(bossFightEnemy.type);
      }
      return;
    }

    if (spawnInterval !== null && this.steps % spawnInterval === 0) {
      this.spawnEnemy(this.rules.pickEnemyType(this.random));
    }
  }

  /**
   * Toca la lucha con los jefes. En la calle entran ahí mismo (tras su texto,
   * si lo hay). En la planta baja del ayuntamiento esperan arriba: el
   * protagonista sube por la escalera y se les encuentra en el despacho.
   */
  private callBosses(): void {
    if (this.room === 'hall') {
      this.startDoorway({ door: CITY_HALL.hall.door, reveal: 0, next: 'office' });
    } else if (!this.openDialog('beforeBosses')) {
      this.spawnBosses();
    }
  }

  private spawnEnemy(type: EnemyTypeId): void {
    const { enemySpeed } = this.rules;
    this.enemies.push(Enemy.spawn(type, this.field, this.random, enemySpeed));
  }

  private spawnBosses(): void {
    const { level, bossField, bossHealth, enemySpeed, cameraEnd } = this.rules;
    // Una calle con final se recorre entera antes del jefe. Solo puede faltar
    // si un admin ha fijado las botellas (y con ellas, no hay que recorrer
    // nada): entonces se salta al final, para que el jefe salga en su sitio
    if (cameraEnd !== null) this.backgroundDistance = Math.max(this.backgroundDistance, cameraEnd);
    const count = level.bosses.length;
    this.bosses = level.bosses.map(
      (id, slot) =>
        new Boss(id, bossField, {
          healthScale: bossHealth,
          slot,
          count,
          random: this.random,
          bottleSpeedScale: enemySpeed,
          // En el despacho, cada uno ya en su puesto
          post: this.room === 'office' ? CITY_HALL.office.posts[id] : undefined,
        }),
    );
    this.bossesSpawned = true;
  }

  /** Una lata cada pickupInterval pasos, también durante el combate con los jefes (ahí es cuando más falta hace). */
  private spawnPickup(): void {
    if (this.steps % this.rules.pickupInterval !== 0) return;
    const type: PickupTypeId = this.random() < PICKUP.healthChance ? 'health' : 'speed';
    this.pickups.push(Pickup.spawn(type, this.field, this.random));
  }

  private resolveCollisions(): void {
    const { player } = this;

    for (const bullet of this.playerBullets) {
      // Abrechapas contra enemigos: las botellas mueren de uno, el barril aguanta más
      for (const enemy of this.enemies) {
        if (bullet.alive && enemy.alive && intersects(bullet, enemy)) {
          bullet.alive = false;
          if (enemy.hit()) this.countKill(enemy);
        }
      }
      // Contra los jefes: la bala se rompe aunque aún estén entrando (y sean
      // invulnerables). Al que protegen otros no se le puede bajar de 1 de vida
      for (const boss of this.bosses) {
        if (bullet.alive && intersects(bullet, boss)) {
          bullet.alive = false;
          boss.hit(PLAYER_BULLET.damage, this.isGuarded(boss) ? 1 : 0);
        }
      }
      // La cerveza que va hacia el alcalde se puede romper antes de que le llegue
      for (const heal of this.heals) {
        if (bullet.alive && heal.alive && intersects(bullet, heal)) {
          bullet.alive = false;
          heal.alive = false;
        }
      }
    }

    // La que llega al alcalde le cura (a quien la lanzan: el jefe protegido)
    for (const heal of this.heals) {
      const target = this.bosses.find((boss) => this.isGuarded(boss));
      if (heal.alive && target && intersects(heal, target)) {
        heal.alive = false;
        target.heal(CITY_HALL.office.heal.amount);
      }
    }

    // La espuma la para la chupa (hasta que se empapa); si no, hace daño
    for (const bullet of this.enemyBullets) {
      if (bullet.alive && intersects(bullet, player)) {
        bullet.alive = false;
        if (player.isShielding) player.blockShot();
        else this.damagePlayer(ENEMY.bulletDamage);
      }
    }

    // Choque con un enemigo: más daño, y el enemigo muere (así no repite daño en
    // cada paso). La chupa no protege de los botellazos. Los seguratas no
    // cuentan: están donde el jugador no llega, y no deben morir de un empujón.
    for (const enemy of this.enemies) {
      if (enemy.alive && !enemy.placed && intersects(enemy, player)) {
        enemy.alive = false;
        this.damagePlayer(ENEMY.contactDamage);
      }
    }

    // Las latas se recogen al tocarlas (las balas las atraviesan: ver config.ts)
    for (const pickup of this.pickups) {
      if (pickup.alive && intersects(pickup, player)) {
        pickup.alive = false;
        this.collect(pickup.type);
      }
    }

    // Choque con un jefe: quita vida, con un tiempo de espera entre golpe y golpe
    for (const boss of this.bosses) {
      if (intersects(boss, player) && boss.tryContactDamage()) {
        this.damagePlayer(BOSS_COMMON.contactDamage);
      }
    }

    for (const boss of this.bosses) {
      if (boss.isDead) this.earnedPoints += BOSS_POINTS[boss.id];
    }
    this.bosses = this.bosses.filter((boss) => !boss.isDead);
  }

  /** true si aún vive alguno de los jefes que protegen a este (BOSS[id].guardedBy). */
  private isGuarded(boss: Boss): boolean {
    return guardiansOf(boss.id).some((id) => this.bosses.some((other) => other.id === id));
  }

  /**
   * Despacho: mientras al alcalde le falte vida y quede alguna chica, cada
   * CITY_HALL.office.heal.gap pasos una de ellas (por turnos) le lanza una
   * cerveza que le cura. Por eso hay que acabar antes con ellas.
   */
  private throwHeals(): void {
    const target = this.bosses.find((boss) => this.isGuarded(boss));
    if (!target || target.isEntering || target.health >= target.maxHealth) return;
    if (--this.healCooldown > 0) return;
    const guardians = guardiansOf(target.id);
    const helpers = this.bosses.filter((boss) => guardians.includes(boss.id) && !boss.isEntering);
    const helper = helpers[this.healTurn++ % helpers.length];
    if (!helper) return;
    this.healCooldown = CITY_HALL.office.heal.gap;
    const center = (boss: Boss) => ({ x: boss.x + boss.width / 2, y: boss.y + boss.height / 2 });
    this.heals.push(new HealingBeer(center(helper), center(target), CITY_HALL.office.heal.speed));
  }

  private countKill(enemy: Enemy): void {
    this.kills++;
    this.earnedPoints += ENEMY_POINTS[enemy.type];
  }

  private collect(type: PickupTypeId): void {
    if (type === 'health') this.player.heal(this.rules.healAmount);
    else this.player.boost();
  }

  /** El truco de inmortalidad y el daño de la dificultad se aplican aquí, en un único sitio. */
  private damagePlayer(amount: number): void {
    if (!this.rules.invincible) this.player.takeDamage(Math.round(amount * this.rules.damageTaken));
  }

  /**
   * ¿Fin de partida? La victoria se comprueba antes: si en el mismo paso se
   * gana y se pierde la última vida, se le da la victoria al jugador. Si hay
   * texto tras los jefes, la victoria llega al cerrarlo (en el siguiente paso);
   * si hay un edificio al final, al entrar en él.
   */
  private checkEnd(): void {
    const won = this.level.bosses.length > 0 ? this.bossesDefeated : this.waveCompleted;
    if (won && this.openDialog('afterBosses')) return;
    const { exit } = this.rules;
    // En el despacho: pantalla negra y de vuelta a la planta baja (ver goDownstairs)
    if (won && this.room === 'office') this.startFadeOut();
    else if (won && exit) this.startDoorway({ ...exit, next: 'victory' });
    else if (won) this.win();
    else if (this.player.isDead) {
      this.setStatus('over');
      this.events.onGameOver?.(this.result);
    }
  }

  /**
   * Empieza una escena de puerta. Lo que quedaba en pantalla desaparece: ya no
   * hay combate, y así nada puede herirle mientras entra.
   */
  private startDoorway(doorway: Doorway): void {
    this.doorway = doorway;
    this.clearScreen();
  }

  /** Quita todo lo que vuela o cae: en las escenas sin combate nada puede herirle. */
  private clearScreen(): void {
    this.enemies = [];
    this.enemyBullets = [];
    this.playerBullets = [];
    this.pickups = [];
    this.heals = [];
  }

  /** La pantalla empieza a fundirse a negro (al vencer en el despacho). */
  private startFadeOut(): void {
    this.clearScreen();
    this.fadeOutSteps = FINALE.fadeSteps;
  }

  /** Fundido a negro, paso a paso; ya en negro, a la planta baja. */
  private fadeOut(): void {
    this.fadeOutSteps--;
    if (this.fadeOutSteps === 0) this.goDownstairs();
  }

  /**
   * Vuelta a la planta baja tras vencer al alcalde: ya no hay nadie ni fiesta.
   * Aparece abajo, la pantalla vuelve a verse y queda el último texto (ending).
   */
  private goDownstairs(): void {
    this.room = 'hall';
    this.field = CITY_HALL.hall.field;
    this.dancers = [];
    this.placePlayerAtStart();
    this.ending = true;
    this.fadeInSteps = FINALE.fadeSteps;
  }

  /** Pone al protagonista abajo en el centro, mirando hacia delante, como al empezar. */
  private placePlayerAtStart(): void {
    const start = Player.spawn();
    this.player.x = start.x;
    this.player.y = start.y;
    this.player.facing = 'arriba';
  }

  /**
   * Escena de puerta, paso a paso: la cámara sube hasta ver la puerta (el
   * suelo, y él con el suelo, bajan por la pantalla) mientras anda hacia ella;
   * en la puerta sigue hacia dentro mientras desaparece (playerFade) y, ya
   * dentro, la pantalla funde a negro (screenFade). Al acabar el fundido, lo
   * que toque: la victoria o el despacho.
   */
  private walkThroughDoor(): void {
    const { door, reveal, next } = this.doorway!;
    // Las chicas que aún huían siguen a lo suyo mientras él sube
    for (const dancer of this.dancers) dancer.update();
    this.dancers = this.dancers.filter((dancer) => !dancer.isGone);
    const rise = Math.min(FINALE.cameraSpeed, reveal - this.revealed);
    this.revealed += rise;
    this.backgroundDistance += rise;
    this.player.y += rise;

    // La puerta, donde está ahora en la pantalla
    const entrance = { x: door.x, y: door.y + this.revealed };
    if (!this.atDoor) {
      this.atDoor = this.player.walkTo(entrance, FINALE.exitSpeed);
      return;
    }
    this.insideSteps++;
    this.player.walkTo({ x: entrance.x, y: entrance.y - FINALE.vanishDistance }, FINALE.exitSpeed);
    if (this.insideSteps < VANISH_STEPS + FINALE.fadeSteps) return;
    if (next === 'victory') this.win();
    else this.enterOffice();
  }

  /**
   * Llega al despacho del alcalde: aparece abajo, en la entrada, con los jefes
   * ya en su puesto, y la pantalla deja de estar en negro poco a poco.
   */
  private enterOffice(): void {
    this.doorway = null;
    this.revealed = 0;
    this.atDoor = false;
    this.insideSteps = 0;
    this.room = 'office';
    this.field = CITY_HALL.office.field;
    this.placePlayerAtStart();
    this.spawnBosses();
    this.fadeInSteps = FINALE.fadeSteps;
  }

  /** La pantalla vuelve a verse. Mientras, nada se mueve; al acabar, en el despacho, el texto de los jefes. */
  private fadeIn(): void {
    this.fadeInSteps--;
    if (this.fadeInSteps === 0 && this.room === 'office') this.openDialog('beforeBosses');
  }

  private win(): void {
    this.setStatus('victory');
    this.events.onVictory?.(this.result);
  }

  private setStatus(status: GameStatus): void {
    this.currentStatus = status;
    this.events.onStatusChange?.(status);
  }
}
