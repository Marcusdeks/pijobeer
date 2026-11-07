/**
 * ENEMIGO que cae durante el nivel: botellas y barriles pequeños. También lo
 * que lanzan los jefes (las botellas de los pijos y los barriles del primo) y
 * los seguratas del nivel 6, que no caen: ya están en la sala (ver placed).
 *
 * Su TIPO (ver ENEMY_TYPES en config.ts) decide su velocidad, su tamaño,
 * cuántos impactos aguanta, cada cuánto dispara y si apunta al jugador.
 *
 * Cómo se mueve:
 *   - Lo normal: cae recto hacia abajo.
 *   - Lanzado por un jefe (thrown): sale recto hacia donde estaba el jugador
 *     al lanzarlo (THROWN), sin cambiar de rumbo. Las botellas disparan hacia
 *     donde van; los barriles, hacia el jugador, como siempre.
 *   - Colocado (placed, los seguratas): no se mueve. Dispara como un barril,
 *     pero solo desde que GameSession le avisa de que ha saltado la alarma (arm).
 *
 * Cada disparo de una botella es una pequeña animación:
 *
 *   cerrada (0) ─► salta la chapa (1) ─► explota la espuma (2) ─► gotea (3) ─► abierta (4) ─► cerrada (0)
 *                                        └─ aquí sale la bala
 *
 * La bala no sale al empezar la animación sino en la explosión: ver saltar
 * la chapa avisa al jugador y le da tiempo a esquivar. Los barriles no tienen
 * chapa: disparan directamente, apuntando a donde está el jugador, uno o
 * varios chorros en abanico según su tipo (streams).
 *
 * Sus balas NO se guardan dentro del enemigo: update() las devuelve y
 * GameSession las mete en una lista común, así siguen volando aunque el
 * enemigo muera.
 */
import type { EnemyTypeId } from '@pijobeer/shared';
import {
  ARENA,
  BOSS_COMMON,
  ENEMY,
  ENEMY_BULLET,
  ENEMY_TYPES,
  HIT_FLASH_STEPS,
  type ThrowStats,
} from '../config';
import { aimDegrees, directionDegrees, velocityAt, type Point, type Rect } from '../geometry';
import type { Playfield } from '../playfield';
import { Bullet } from './Bullet';

/** Función que devuelve un número aleatorio en [0, 1), como Math.random. */
export type RandomFn = () => number;

/** Frame de reposo (botella cerrada). */
const IDLE_FRAME = 0;
/** Pasos que dura la animación de disparo completa. */
const SHOT_STEPS = ENEMY.shootAnimation.length * ENEMY.shootFrameSteps;

export class Enemy implements Rect {
  readonly width: number;
  readonly height: number;
  /** false cuando lo han eliminado: se retira al final del paso. */
  alive = true;
  /**
   * Hacia dónde se mueve, en grados desde la vertical hacia ABAJO (0 = cae
   * recto, positivo = hacia la derecha). Lo usa el renderer para girar las
   * botellas lanzadas.
   */
  heading = 0;
  /** true si lo ha lanzado un jefe. */
  readonly thrown: boolean;
  /** true si ya estaba en la sala al empezar (los seguratas: ver Enemy.placed). */
  placed = false;
  /** Qué dibujo lleva, entre los de su tipo (el número de segurata). */
  look = 0;
  /** Pasos que lleva en juego: marcan el frame de su baile (los seguratas). */
  age = 0;

  /** Desplazamiento por paso, calculado una vez: el rumbo no cambia en vuelo. */
  private velocity: Point = { x: 0, y: 0 };

  private readonly stats: (typeof ENEMY_TYPES)[EnemyTypeId];
  private readonly speed: number;
  /** Impactos que le quedan. */
  private hitsLeft: number;
  /** Pasos que quedan de destello blanco. */
  private flashSteps = 0;
  /** Pasos que faltan para empezar el siguiente disparo. */
  private cooldown: number;
  /** Pasos desde que empezó la animación de disparo, o null si no está disparando. */
  private shotStep: number | null = null;
  /** Disparos que le quedan (lo lanzado puede tener un límite: ver ThrowStats.shots). */
  private shotsLeft: number;
  /** Pasos de espera entre un disparo y el siguiente. */
  private readonly reload: number;
  /** false hasta que puede disparar (los colocados esperan a la alarma). */
  private armed = true;

  /**
   * @param speedScale - multiplicador de velocidad del nivel (y de los trucos de admin)
   * @param throwing - cómo vuela si lo ha lanzado un jefe (va hacia el jugador
   *   en vez de caer recto), o null si cae como siempre
   */
  constructor(
    public x: number,
    public y: number,
    readonly type: EnemyTypeId,
    random: RandomFn,
    speedScale = 1,
    throwing: ThrowStats | null = null,
  ) {
    this.stats = ENEMY_TYPES[type];
    this.width = this.stats.width;
    this.height = this.stats.height;
    this.hitsLeft = this.stats.hits;
    this.thrown = throwing !== null;
    this.speed = (throwing?.speed ?? this.stats.speed) * speedScale;
    this.velocity = velocityAt(0, this.speed);
    this.shotsLeft = throwing?.shots ?? Infinity;
    this.reload = throwing?.shotGap ?? this.stats.shootCooldown;
    // Primer disparo con retraso aleatorio, para que no disparen todos a la vez.
    // Lo lanzado, cuando diga su lanzamiento (las botellas van tan rápido que,
    // si esperasen como las demás, llegarían sin haber disparado).
    const [min, max] = throwing ? [throwing.firstShot, throwing.firstShot] : this.stats.firstShot;
    this.cooldown = min + Math.floor(random() * (max - min));
  }

  /**
   * Crea un enemigo en una X aleatoria del suelo, justo por ENCIMA del borde
   * superior (fuera de la vista), para que "entre" cayendo.
   */
  static spawn(type: EnemyTypeId, field: Playfield, random: RandomFn, speedScale = 1): Enemy {
    const { width, height } = ENEMY_TYPES[type];
    // Media de varios sorteos: los valores del centro salen más (ver ENEMY.spawnCenterBias)
    let roll = 0;
    for (let i = 0; i < ENEMY.spawnCenterBias; i++) roll += random();
    const x = field.left + (roll / ENEMY.spawnCenterBias) * (field.right - field.left - width);
    return new Enemy(x, -height, type, random, speedScale);
  }

  /**
   * Lanzado por un jefe: sale de `from` hacia donde está ahora el jugador
   * (`target`), con la velocidad y el primer disparo de `throwing`.
   */
  static thrownAt(
    type: EnemyTypeId,
    from: Point,
    target: Point,
    random: RandomFn,
    throwing: ThrowStats,
    speedScale = 1,
  ): Enemy {
    const { width, height } = ENEMY_TYPES[type];
    const x = from.x - width / 2;
    const thrown = new Enemy(x, from.y - height / 2, type, random, speedScale, throwing);
    thrown.heading = aimDegrees(from, target, BOSS_COMMON.maxAimDeg);
    thrown.velocity = velocityAt(thrown.heading, thrown.speed);
    return thrown;
  }

  /**
   * Un enemigo que ya está en la sala al empezar: con los pies en `feet`, sin
   * moverse y sin disparar hasta que se le llame a arm(). `look`: qué dibujo
   * lleva. `phase`: pasos de baile adelantados, para que no bailen todos a la vez.
   */
  static placed(type: EnemyTypeId, feet: Point, look: number, random: RandomFn, phase = 0): Enemy {
    const { width, height } = ENEMY_TYPES[type];
    const enemy = new Enemy(feet.x - width / 2, feet.y - height, type, random, 0);
    enemy.placed = true;
    enemy.armed = false;
    enemy.look = look;
    enemy.age = phase;
    return enemy;
  }

  /** Puede empezar a disparar (ha saltado la alarma). */
  arm(): void {
    this.armed = true;
  }

  /** Frame de la hoja que toca dibujar: el de la animación de disparo, o el de reposo. */
  get animationFrame(): number {
    if (this.shotStep === null) return IDLE_FRAME;
    return ENEMY.shootAnimation[Math.floor(this.shotStep / ENEMY.shootFrameSteps)] ?? IDLE_FRAME;
  }

  /** true durante el destello: el renderer dibuja la silueta blanca. */
  get isFlashing(): boolean {
    return this.flashSteps > 0;
  }

  /** Centro de la caja de colisión. */
  get center(): Point {
    return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
  }

  /**
   * Recibe un abrechapas.
   * @returns true si con este impacto ha muerto
   */
  hit(): boolean {
    this.hitsLeft--;
    if (this.hitsLeft > 0) {
      this.flashSteps = HIT_FLASH_STEPS;
      return false;
    }
    this.alive = false;
    return true;
  }

  /**
   * Avanza un paso: se mueve y gestiona el disparo.
   * @param target - el centro del jugador (al que apuntan los barriles)
   * @returns las balas disparadas en este paso (ninguna, una o un abanico)
   */
  update(target?: Point): Bullet[] {
    if (this.flashSteps > 0) this.flashSteps--;
    this.age++;
    this.x += this.velocity.x;
    this.y += this.velocity.y;
    if (!this.armed) return [];
    return this.stats.kind === 'bottle' ? this.updateBottleShot() : this.updateDirectShot(target);
  }

  /** true si ya ha salido de la pantalla por abajo o (las lanzadas) por un lado. */
  isOutOfBounds(arenaHeight: number): boolean {
    return this.y > arenaHeight || this.x + this.width < 0 || this.x > ARENA.width;
  }

  /** Botellas: la animación de la chapa y la espuma en el frame de la explosión. */
  private updateBottleShot(): Bullet[] {
    if (this.shotStep === null) {
      // Empieza la animación de disparo (si aún le quedan)
      if (--this.cooldown <= 0 && this.shotsLeft > 0) this.shotStep = 0;
      return [];
    }

    const frameBefore = this.animationFrame;
    if (++this.shotStep >= SHOT_STEPS) {
      // Fin de la animación: vuelve a estar cerrada y espera al siguiente disparo
      this.shotStep = null;
      this.cooldown = this.reload;
      return [];
    }

    // La bala sale justo en el paso en que se entra en el frame de la espuma
    const fires = frameBefore !== ENEMY.fireOnFrame && this.animationFrame === ENEMY.fireOnFrame;
    if (!fires) return [];
    this.shotsLeft--;
    return [this.createBullet(this.heading)];
  }

  /**
   * Barril (y segurata): sin animación de disparo; al acabar la espera
   * dispara hacia el jugador (los de aimAround, esté donde esté: también
   * hacia arriba o de lado si ya les ha pasado). Con varios chorros, en abanico de spreadDeg grados centrado en él
   * (con 3 y 40°: a -20, 0 y 20 grados de la dirección del jugador).
   */
  private updateDirectShot(target?: Point): Bullet[] {
    if (--this.cooldown > 0 || this.shotsLeft <= 0) return [];
    this.cooldown = this.reload;
    this.shotsLeft--;
    const { streams, spreadDeg } = this.stats;
    const center = !target
      ? 0
      : this.stats.aimAround
        ? directionDegrees(this.center, target)
        : aimDegrees(this.muzzle(0), target, BOSS_COMMON.maxAimDeg);
    return Array.from({ length: streams }, (_, i) => {
      const offset = streams > 1 ? (i / (streams - 1) - 0.5) * spreadDeg : 0;
      return this.createBullet(center + offset);
    });
  }

  /**
   * Por dónde sale la espuma: por el cuello (o la base del barril), en el lado
   * hacia el que se dispara y un poco separada, para que no nazca dentro.
   */
  private muzzle(degrees: number): Point {
    const offset = velocityAt(degrees, this.height / 2 + ENEMY.bulletGap);
    return { x: this.center.x + offset.x, y: this.center.y + offset.y };
  }

  /** Espuma en la dirección indicada (0 = recta hacia abajo). */
  private createBullet(degrees: number): Bullet {
    const { x, y } = this.muzzle(degrees);
    const velocity = velocityAt(degrees, ENEMY_BULLET.speed);
    return new Bullet(x - ENEMY_BULLET.width / 2, y, velocity.y, ENEMY_BULLET, velocity.x);
  }
}
