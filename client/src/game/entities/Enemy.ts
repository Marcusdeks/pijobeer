/**
 * ENEMIGO que cae durante el nivel: botellas y el barril pequeño del nivel 4.
 * También las botellas que lanzan los pijos (jefes del nivel 4).
 *
 * Su TIPO (ver ENEMY_TYPES en config.ts) decide su velocidad, su tamaño,
 * cuántos impactos aguanta, cada cuánto dispara y si apunta al jugador.
 *
 * Cómo se mueve:
 *   - Lo normal: cae recto hacia abajo.
 *   - Lanzada por un pijo (thrown): sale recta hacia donde estaba el jugador
 *     al lanzarla (THROWN_BOTTLE), sin cambiar de rumbo, y dispara hacia donde va.
 *
 * Cada disparo de una botella es una pequeña animación:
 *
 *   cerrada (0) ─► salta la chapa (1) ─► explota la espuma (2) ─► gotea (3) ─► abierta (4) ─► cerrada (0)
 *                                        └─ aquí sale la bala
 *
 * La bala no sale al empezar la animación sino en la explosión: ver saltar
 * la chapa avisa al jugador y le da tiempo a esquivar. El barril no tiene
 * chapa: dispara directamente, apuntando a donde está el jugador.
 *
 * Sus balas NO se guardan dentro del enemigo: update() las devuelve y
 * GameSession las mete en una lista común, así siguen volando aunque el
 * enemigo muera.
 */
import type { EnemyTypeId } from '@pijobeer/shared';
import { ARENA, BOSS_COMMON, ENEMY, ENEMY_BULLET, ENEMY_TYPES, THROWN_BOTTLE } from '../config';
import { aimDegrees, velocityAt, type Point, type Rect } from '../geometry';
import type { Playfield } from '../playfield';
import { Bullet } from './Bullet';

/** Función que devuelve un número aleatorio en [0, 1), como Math.random. */
export type RandomFn = () => number;

/** Frame de reposo (botella cerrada). */
const IDLE_FRAME = 0;
/** Pasos que dura la animación de disparo completa. */
const SHOT_STEPS = ENEMY.shootAnimation.length * ENEMY.shootFrameSteps;
/** Pasos del destello blanco al recibir un impacto que no lo mata (barril). */
const HIT_FLASH_STEPS = 4;

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

  /**
   * @param speedScale - multiplicador de velocidad del nivel (y de los trucos de admin)
   * @param thrown - true si la ha lanzado un pijo: va hacia el jugador en vez de caer recta
   */
  constructor(
    public x: number,
    public y: number,
    readonly type: EnemyTypeId,
    random: RandomFn,
    speedScale = 1,
    readonly thrown = false,
  ) {
    this.stats = ENEMY_TYPES[type];
    this.width = this.stats.width;
    this.height = this.stats.height;
    this.hitsLeft = this.stats.hits;
    this.speed = (thrown ? THROWN_BOTTLE.speed : this.stats.speed) * speedScale;
    this.velocity = velocityAt(0, this.speed);
    // Primer disparo con retraso aleatorio, para que no disparen todos a la vez.
    // Las lanzadas, enseguida: van tan rápido que si no llegarían sin disparar.
    const [min, max] = thrown
      ? [THROWN_BOTTLE.firstShot, THROWN_BOTTLE.firstShot]
      : this.stats.firstShot;
    this.cooldown = min + Math.floor(random() * (max - min));
  }

  /**
   * Crea un enemigo en una X aleatoria del suelo, justo por ENCIMA del borde
   * superior (fuera de la vista), para que "entre" cayendo.
   */
  static spawn(type: EnemyTypeId, field: Playfield, random: RandomFn, speedScale = 1): Enemy {
    const { width, height } = ENEMY_TYPES[type];
    const x = field.left + random() * (field.right - field.left - width);
    return new Enemy(x, -height, type, random, speedScale);
  }

  /** Botella lanzada por un pijo: sale de `from` hacia donde está ahora el jugador (`target`). */
  static thrownAt(
    type: EnemyTypeId,
    from: Point,
    target: Point,
    random: RandomFn,
    speedScale = 1,
  ): Enemy {
    const { width, height } = ENEMY_TYPES[type];
    const bottle = new Enemy(
      from.x - width / 2,
      from.y - height / 2,
      type,
      random,
      speedScale,
      true,
    );
    bottle.heading = aimDegrees(from, target, BOSS_COMMON.maxAimDeg);
    bottle.velocity = velocityAt(bottle.heading, bottle.speed);
    return bottle;
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
   * @param target - el centro del jugador (al que apunta el barril)
   * @returns la bala disparada en este paso, o null
   */
  update(target?: Point): Bullet | null {
    if (this.flashSteps > 0) this.flashSteps--;
    this.x += this.velocity.x;
    this.y += this.velocity.y;
    return this.stats.variant === null ? this.updateDirectShot(target) : this.updateBottleShot();
  }

  /** true si ya ha salido de la pantalla por abajo o (las lanzadas) por un lado. */
  isOutOfBounds(arenaHeight: number): boolean {
    return this.y > arenaHeight || this.x + this.width < 0 || this.x > ARENA.width;
  }

  /** Botellas: la animación de la chapa y la espuma en el frame de la explosión. */
  private updateBottleShot(): Bullet | null {
    if (this.shotStep === null) {
      if (--this.cooldown <= 0) this.shotStep = 0; // empieza la animación de disparo
      return null;
    }

    const frameBefore = this.animationFrame;
    if (++this.shotStep >= SHOT_STEPS) {
      // Fin de la animación: vuelve a estar cerrada y espera al siguiente disparo
      this.shotStep = null;
      this.cooldown = this.stats.shootCooldown;
      return null;
    }

    // La bala sale justo en el paso en que se entra en el frame de la espuma
    const fires = frameBefore !== ENEMY.fireOnFrame && this.animationFrame === ENEMY.fireOnFrame;
    return fires ? this.createBullet(this.heading) : null;
  }

  /** Barril: sin animación; al acabar la espera dispara hacia el jugador. */
  private updateDirectShot(target?: Point): Bullet | null {
    if (--this.cooldown > 0) return null;
    this.cooldown = this.stats.shootCooldown;
    const degrees = target ? aimDegrees(this.muzzle(0), target, BOSS_COMMON.maxAimDeg) : 0;
    return this.createBullet(degrees);
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
