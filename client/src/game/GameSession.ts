/**
 * PARTIDA: el estado y las reglas de una partida, de principio a fin.
 *
 * Es el corazón del motor. Cada llamada a step() avanza el mundo exactamente
 * UN paso (1/60 s): mover, hacer aparecer enemigos, resolver colisiones,
 * retirar lo que sobra y comprobar si la partida ha terminado.
 *
 * Estados:   running ⇄ paused     running ─► victory     running ─► over
 * ("victory" y "over" son finales: la partida ya no avanza.)
 *
 * Latas: cada cierto tiempo (según la dificultad) cae una lata. La verde
 * cura y la de leopardo acelera al jugador durante unos segundos.
 *
 * Cómo se supera un nivel:
 *   - Sin jefe: eliminando las botellas que piden las reglas.
 *   - Con jefe: al eliminarlas dejan de salir botellas y entra el jefe; se
 *     gana al derrotarlo.
 *
 * No dibuja nada (eso es renderer.ts) ni sabe de React. Avisa de lo que pasa
 * con eventos (callbacks), y React decide qué menús enseñar o qué guardar.
 */
import {
  BOSS_POINTS,
  POINTS_PER_KILL,
  type DifficultyId,
  type GameModifiers,
} from '@pijobeer/shared';
import { ARENA, BACKGROUND_FOLLOW, BOSS_COMMON, ENEMY, type PickupTypeId } from './config';
import { Boss } from './entities/Boss';
import type { Bullet } from './entities/Bullet';
import { Enemy, type RandomFn } from './entities/Enemy';
import { Pickup } from './entities/Pickup';
import { Player } from './entities/Player';
import { intersects } from './geometry';
import type { InputState } from './input/InputState';
import { resolveRules, type GameRules } from './rules';

export type GameStatus = 'running' | 'paused' | 'victory' | 'over';

export interface GameResult {
  level: number;
  kills: number;
  points: number;
}

export interface GameEvents {
  /** Cambio de estado (para enseñar u ocultar los menús de pausa y victoria). */
  onStatusChange?: (status: GameStatus) => void;
  /** Ha aparecido el jefe final (p. ej. para cambiar la música). */
  onBossAppear?: () => void;
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
  /** Jefe en pantalla, o null si aún no ha aparecido (o el nivel no tiene). */
  boss: Boss | null = null;
  kills = 0;
  /** Pasos jugados (sin contar pausas). Marca el ritmo de aparición de botellas y latas. */
  steps = 0;
  /** Píxeles que ha avanzado el fondo del callejón (sigue al jugador, ver BACKGROUND_FOLLOW). */
  backgroundDistance = 0;

  private currentStatus: GameStatus = 'running';
  private bossDefeated = false;
  private readonly events: GameEvents;
  private readonly random: RandomFn;

  constructor({
    levelId,
    modifiers,
    difficulty,
    events = {},
    random = Math.random,
  }: GameSessionOptions) {
    this.rules = resolveRules(levelId, modifiers, difficulty);
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
   * Puntos de las botellas eliminadas más el premio del jefe, si se ha
   * derrotado, por el multiplicador de la dificultad. Se redondea a un
   * múltiplo de POINTS_PER_KILL porque el servidor rechaza cualquier otra cifra.
   */
  get points(): number {
    const bonus = this.bossDefeated && this.level.boss ? BOSS_POINTS[this.level.boss] : 0;
    const raw = (this.kills * POINTS_PER_KILL + bonus) * this.rules.pointsScale;
    return Math.round(raw / POINTS_PER_KILL) * POINTS_PER_KILL;
  }

  get result(): GameResult {
    return { level: this.level.id, kills: this.kills, points: this.points };
  }

  /** true cuando ya se han eliminado las botellas que piden las reglas. */
  get waveCompleted(): boolean {
    return this.kills >= this.rules.killsToComplete;
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

  /** Avanza la simulación un paso. En pausa o terminada, no cambia nada. */
  step(input: InputState): void {
    if (this.currentStatus !== 'running') return;
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

  private moveEverything(input: InputState): void {
    const shot = this.player.update(input, this.rules.field);
    if (shot) this.playerBullets.push(shot);
    this.backgroundDistance += this.player.forwardMotion * BACKGROUND_FOLLOW;

    for (const enemy of this.enemies) {
      const enemyShot = enemy.update();
      if (enemyShot) this.enemyBullets.push(enemyShot);
    }
    // El jefe apunta al centro del jugador
    if (this.boss) {
      const { player } = this;
      const target = { x: player.x + player.width / 2, y: player.y + player.height / 2 };
      this.enemyBullets.push(...this.boss.update(target));
    }

    for (const pickup of this.pickups) pickup.update();
    for (const bullet of this.playerBullets) bullet.update();
    for (const bullet of this.enemyBullets) bullet.update();
  }

  /**
   * Botellas al ritmo del nivel. Cumplido el objetivo de un nivel con jefe,
   * aparece el jefe (una vez) y las botellas siguen cayendo, pero a menor
   * ritmo (BOSS_COMMON.minionSpawnFactor), para que el combate no dé respiro.
   */
  private spawn(): void {
    const { level, field, spawnInterval, enemySpeed, bossHealth } = this.rules;
    let interval = spawnInterval;

    if (level.boss && this.waveCompleted) {
      if (this.bossDefeated) return;
      if (!this.boss) {
        this.boss = new Boss(level.boss, field, bossHealth);
        this.events.onBossAppear?.();
      }
      interval = spawnInterval * BOSS_COMMON.minionSpawnFactor;
    }

    if (this.steps % interval === 0) {
      const type = this.rules.pickEnemyType(this.random);
      this.enemies.push(Enemy.spawn(type, field, this.random, enemySpeed));
    }
  }

  /** Una lata cada pickupInterval pasos, también durante el combate con el jefe (ahí es cuando más falta hace). */
  private spawnPickup(): void {
    if (this.steps % this.rules.pickupInterval !== 0) return;
    const type: PickupTypeId = this.random() < 0.5 ? 'health' : 'speed';
    this.pickups.push(Pickup.spawn(type, this.rules.field, this.random));
  }

  private resolveCollisions(): void {
    const { player, boss } = this;

    for (const bullet of this.playerBullets) {
      // Abrechapas contra botellas: muere de un disparo
      for (const enemy of this.enemies) {
        if (bullet.alive && enemy.alive && intersects(bullet, enemy)) {
          bullet.alive = enemy.alive = false;
          this.kills++;
        }
      }
      // Contra el jefe: la bala se rompe aunque él aún esté entrando (y sea invulnerable)
      if (boss && bullet.alive && intersects(bullet, boss)) {
        bullet.alive = false;
        boss.hit();
      }
    }

    for (const bullet of this.enemyBullets) {
      if (bullet.alive && intersects(bullet, player)) {
        bullet.alive = false;
        this.damagePlayer(ENEMY.bulletDamage);
      }
    }

    // Choque con una botella: más daño, y la botella muere (así no repite daño en cada paso)
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

    // Choque con el jefe: quita vida, con un tiempo de espera entre golpe y golpe
    if (boss && intersects(boss, player) && boss.tryContactDamage()) {
      this.damagePlayer(BOSS_COMMON.contactDamage);
    }

    if (boss?.isDead) {
      this.bossDefeated = true;
      this.boss = null;
    }
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
   * gana y se pierde la última vida, se le da la victoria al jugador.
   */
  private checkEnd(): void {
    const won = this.level.boss ? this.bossDefeated : this.waveCompleted;
    if (won) {
      this.setStatus('victory');
      this.events.onVictory?.(this.result);
    } else if (this.player.isDead) {
      this.setStatus('over');
      this.events.onGameOver?.(this.result);
    }
  }

  private setStatus(status: GameStatus): void {
    this.currentStatus = status;
    this.events.onStatusChange?.(status);
  }
}
