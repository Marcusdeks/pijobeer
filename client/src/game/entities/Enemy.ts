/**
 * BOTELLA (enemigo).
 *
 * Bajan en línea recta, boca abajo, y disparan espuma cada cierto tiempo.
 * Su TIPO (normal, rápida o pesada) decide su velocidad, cada cuánto dispara
 * y su color: ver ENEMY_TYPES en config.ts.
 *
 * Cada disparo es una pequeña animación:
 *
 *   cerrada (0) ─► salta la chapa (1) ─► explota la espuma (2) ─► gotea (3) ─► abierta (4) ─► cerrada (0)
 *                                        └─ aquí sale la bala
 *
 * La bala no sale al empezar la animación sino en la explosión: ver saltar
 * la chapa avisa al jugador y le da tiempo a esquivar.
 *
 * Sus balas NO se guardan dentro de la botella: update() las devuelve y
 * GameSession las mete en una lista común, así siguen volando aunque la
 * botella muera.
 */
import type { EnemyTypeId } from '@pijobeer/shared';
import { ENEMY, ENEMY_BULLET, ENEMY_TYPES } from '../config';
import type { Rect } from '../geometry';
import type { Playfield } from '../playfield';
import { Bullet } from './Bullet';

/** Función que devuelve un número aleatorio en [0, 1), como Math.random. */
export type RandomFn = () => number;

/** Frame de reposo (botella cerrada). */
const IDLE_FRAME = 0;
/** Pasos que dura la animación de disparo completa. */
const SHOT_STEPS = ENEMY.shootAnimation.length * ENEMY.shootFrameSteps;

export class Enemy implements Rect {
  readonly width = ENEMY.width;
  readonly height = ENEMY.height;
  /** false cuando lo han eliminado: se retira al final del paso. */
  alive = true;

  private readonly speed: number;
  /** Pasos que faltan para empezar el siguiente disparo. */
  private cooldown: number;
  /** Pasos desde que empezó la animación de disparo, o null si no está disparando. */
  private shotStep: number | null = null;

  /**
   * @param speedScale - multiplicador de velocidad del nivel (y de los trucos de admin)
   */
  constructor(
    public x: number,
    public y: number,
    readonly type: EnemyTypeId,
    random: RandomFn,
    speedScale = 1,
  ) {
    this.speed = ENEMY_TYPES[type].speed * speedScale;
    // Primer disparo con retraso aleatorio, para que no disparen todas a la vez
    const spread = ENEMY.firstShotDelayMax - ENEMY.firstShotDelayMin;
    this.cooldown = ENEMY.firstShotDelayMin + Math.floor(random() * spread);
  }

  /**
   * Crea una botella en una X aleatoria del suelo, justo por ENCIMA del borde
   * superior (fuera de la vista), para que "entre" cayendo.
   */
  static spawn(type: EnemyTypeId, field: Playfield, random: RandomFn, speedScale = 1): Enemy {
    const x = field.left + random() * (field.right - field.left - ENEMY.width);
    return new Enemy(x, -ENEMY.height, type, random, speedScale);
  }

  /** Frame de la hoja que toca dibujar: el de la animación de disparo, o el de reposo. */
  get animationFrame(): number {
    if (this.shotStep === null) return IDLE_FRAME;
    return ENEMY.shootAnimation[Math.floor(this.shotStep / ENEMY.shootFrameSteps)] ?? IDLE_FRAME;
  }

  /**
   * Avanza un paso: baja y gestiona el disparo.
   * @returns la bala disparada en este paso, o null
   */
  update(): Bullet | null {
    this.y += this.speed;

    if (this.shotStep === null) {
      if (--this.cooldown <= 0) this.shotStep = 0; // empieza la animación de disparo
      return null;
    }

    const frameBefore = this.animationFrame;
    if (++this.shotStep >= SHOT_STEPS) {
      // Fin de la animación: vuelve a estar cerrada y espera al siguiente disparo
      this.shotStep = null;
      this.cooldown = ENEMY_TYPES[this.type].shootCooldown;
      return null;
    }

    // La bala sale justo en el paso en que se entra en el frame de la espuma
    const fires = frameBefore !== ENEMY.fireOnFrame && this.animationFrame === ENEMY.fireOnFrame;
    return fires ? this.createBullet() : null;
  }

  /** true si ha bajado del todo sin que le disparen. */
  isOutOfBounds(arenaHeight: number): boolean {
    return this.y > arenaHeight;
  }

  /** La espuma sale por el cuello (abajo, al estar boca abajo), un poco separada de él. */
  private createBullet(): Bullet {
    const x = this.x + this.width / 2 - ENEMY_BULLET.width / 2;
    const y = this.y + this.height + ENEMY.bulletGap;
    return new Bullet(x, y, ENEMY_BULLET.speed, ENEMY_BULLET);
  }
}
