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
 * protagonista entra solo en el edificio (rules.exit): anda hasta la puerta,
 * desaparece en lo oscuro y la pantalla funde a negro; entonces, la victoria.
 * Mientras entra no hay enemigos, ni se le puede manejar.
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
  type DifficultyId,
  type EnemyTypeId,
  type GameModifiers,
} from '@pijobeer/shared';
import { ARENA, BOSS_COMMON, ENEMY, FINALE, PICKUP, type PickupTypeId } from './config';
import { Boss } from './entities/Boss';
import type { Bullet } from './entities/Bullet';
import { Enemy, type RandomFn } from './entities/Enemy';
import { Pickup } from './entities/Pickup';
import { Player } from './entities/Player';
import { clamp, intersects } from './geometry';
import type { InputState } from './input/InputState';
import { resolveRules, type GameRules } from './rules';

export type GameStatus = 'running' | 'paused' | 'dialog' | 'victory' | 'over';

/** Pasos que tarda el protagonista en desaparecer en lo oscuro de la puerta (ver FINALE). */
const VANISH_STEPS = Math.ceil(FINALE.vanishDistance / FINALE.exitSpeed);

/**
 * Momentos en los que la partida se puede parar para enseñar un texto:
 *   opening       nada más empezar
 *   beforeBosses  justo antes de que entren los jefes
 *   afterBosses   al derrotarlos, antes de dar la victoria
 * Qué texto sale (y si sale) lo decide React; el motor solo se para y avisa.
 */
export type DialogMoment = 'opening' | 'beforeBosses' | 'afterBosses';

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
  kills = 0;
  /** Pasos jugados (sin contar pausas ni textos). Marca el ritmo de aparición de botellas y latas. */
  steps = 0;
  /** Píxeles que ha avanzado el callejón (ver CAMERA en config.ts). */
  backgroundDistance = 0;

  private currentStatus: GameStatus = 'running';
  /** Ya han entrado los jefes (aunque luego se les derrote y desaparezcan). */
  private bossesSpawned = false;
  /** Escena final: el protagonista está entrando solo en el edificio (ver rules.exit). */
  private exiting = false;
  /** Escena final: ya ha llegado a la puerta, y los pasos que lleva desde entonces. */
  private atDoor = false;
  private insideSteps = 0;
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
   * Escena final: cuánto ha desaparecido el protagonista en lo oscuro de la
   * puerta (0 = se le ve entero, 1 = ya no se le ve) y cuánto se ha fundido
   * la pantalla a negro después (0 = nada, 1 = negra del todo). Los usa el renderer.
   */
  get playerFade(): number {
    return clamp(this.insideSteps / VANISH_STEPS, 0, 1);
  }

  get screenFade(): number {
    return clamp((this.insideSteps - VANISH_STEPS) / FINALE.fadeSteps, 0, 1);
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
    if (this.exiting) return this.walkInside();
    this.steps++;

    this.moveEverything(input);
    this.spawn();
    this.spawnPickup();
    this.resolveCollisions();

    // Limpieza: sin ella las listas crecerían sin parar y el juego iría cada vez más lento
    this.enemies = this.enemies.filter(isStillInPlay);
    this.pickups = this.pickups.filter(isStillInPlay);
    this.playerBullets = this.playerBullets.filter(isStillInPlay);
    this.enemyBullets = this.enemyBullets.filter(isStillInPlay);

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

  private moveEverything(input: InputState): void {
    const { player, rules } = this;
    // En una calle con final, el callejón no pasa de él
    const roadLeft =
      rules.cameraEnd === null ? Infinity : rules.cameraEnd - this.backgroundDistance;
    const shot = player.update(input, {
      field: rules.field,
      shootCooldown: rules.shootCooldown,
      // Contra los jefes no se avanza: el combate es en el sitio
      canAdvance: !this.bossesSpawned && roadLeft > 0,
      jacketAllowed: this.jacketAllowed,
    });
    if (shot) this.playerBullets.push(shot);
    const advance = Math.min(player.advanceSpeed, roadLeft);
    this.backgroundDistance += advance;

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
   * Botellas al ritmo del nivel. Cumplido el objetivo de un nivel con jefes,
   * entran los jefes (una vez, tras su texto si lo hay) y dejan de caer
   * botellas: el combate es contra ellos, lo que lancen y, si el nivel lo
   * pide (bossFightEnemy), algún enemigo suelto de un tipo concreto.
   */
  private spawn(): void {
    const { level, spawnInterval, bossFightEnemy } = this.rules;

    if (level.bosses.length > 0 && this.waveCompleted) {
      if (!this.bossesSpawned && !this.openDialog('beforeBosses')) this.spawnBosses();
      if (this.bossesSpawned && bossFightEnemy && this.steps % bossFightEnemy.spawnInterval === 0) {
        this.spawnEnemy(bossFightEnemy.type);
      }
      return;
    }

    if (this.steps % spawnInterval === 0) this.spawnEnemy(this.rules.pickEnemyType(this.random));
  }

  private spawnEnemy(type: EnemyTypeId): void {
    const { field, enemySpeed } = this.rules;
    this.enemies.push(Enemy.spawn(type, field, this.random, enemySpeed));
  }

  private spawnBosses(): void {
    const { level, field, bossHealth, enemySpeed, cameraEnd } = this.rules;
    // Una calle con final se recorre entera antes del jefe. Solo puede faltar
    // si un admin ha fijado las botellas (y con ellas, no hay que recorrer
    // nada): entonces se salta al final, para que el jefe salga en su sitio
    if (cameraEnd !== null) this.backgroundDistance = Math.max(this.backgroundDistance, cameraEnd);
    const count = level.bosses.length;
    this.bosses = level.bosses.map(
      (id, slot) =>
        new Boss(id, field, {
          healthScale: bossHealth,
          slot,
          count,
          random: this.random,
          bottleSpeedScale: enemySpeed,
        }),
    );
    this.bossesSpawned = true;
  }

  /** Una lata cada pickupInterval pasos, también durante el combate con los jefes (ahí es cuando más falta hace). */
  private spawnPickup(): void {
    if (this.steps % this.rules.pickupInterval !== 0) return;
    const type: PickupTypeId = this.random() < PICKUP.healthChance ? 'health' : 'speed';
    this.pickups.push(Pickup.spawn(type, this.rules.field, this.random));
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
      // Contra los jefes: la bala se rompe aunque aún estén entrando (y sean invulnerables)
      for (const boss of this.bosses) {
        if (bullet.alive && intersects(bullet, boss)) {
          bullet.alive = false;
          boss.hit();
        }
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
    // cada paso). La chupa no protege de los botellazos.
    for (const enemy of this.enemies) {
      if (enemy.alive && intersects(enemy, player)) {
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
    if (won && this.rules.exit) this.startExit();
    else if (won) this.win();
    else if (this.player.isDead) {
      this.setStatus('over');
      this.events.onGameOver?.(this.result);
    }
  }

  /**
   * Empieza la escena final. Lo que quedaba en pantalla desaparece: con el
   * jefe derrotado ya no hay combate, y así nada puede herirle mientras entra.
   */
  private startExit(): void {
    this.exiting = true;
    this.enemies = [];
    this.enemyBullets = [];
    this.playerBullets = [];
    this.pickups = [];
  }

  /**
   * Escena final, paso a paso: anda hasta la puerta; después sigue hacia
   * dentro mientras desaparece (playerFade) y, ya dentro, la pantalla funde a
   * negro (screenFade). Al acabar el fundido, la victoria.
   */
  private walkInside(): void {
    const door = this.rules.exit!;
    if (!this.atDoor) {
      this.atDoor = this.player.walkTo(door, FINALE.exitSpeed);
      return;
    }
    this.insideSteps++;
    this.player.walkTo({ x: door.x, y: door.y - FINALE.vanishDistance }, FINALE.exitSpeed);
    if (this.insideSteps >= VANISH_STEPS + FINALE.fadeSteps) this.win();
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
