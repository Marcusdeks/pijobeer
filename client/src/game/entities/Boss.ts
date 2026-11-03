/**
 * JEFE FINAL: un barril de cerveza pija (madera o hierro), un pijo o su primo.
 *
 *   1. ENTRADA: baja desde fuera de la pantalla hasta BOSS_COMMON.holdY. Mientras
 *      entra ni ataca ni se le puede dañar (aún no ha empezado el combate).
 *   2. COMBATE: se queda a esa altura (no avanza hacia el jugador), va de pared
 *      a pared y ataca en RÁFAGAS (ver BOSS en config.ts). Mientras ataca se
 *      para (ver isAttacking):
 *        - los barriles disparan abanicos de chorros que pueden apuntar al jugador;
 *        - el pijo lanza botellas hacia donde está él, y el primo, barriles
 *          (ver Enemy.thrownAt). Qué lanza lo decide antes de empezar a coger
 *          impulso, para que el dibujo lo lleve en las manos (ver heldThrow).
 *   3. FURIA: cuando le queda un 20 % de vida se mueve más rápido y cambia su
 *      ritmo de ataque (ver BOSS_ENRAGE y los enraged* de cada jefe).
 *
 * Puede haber varios a la vez (en el nivel 4, dos pijos): cada uno empieza en
 * su hueco del callejón, los vecinos salen en direcciones opuestas y atacan
 * por turnos: cada uno empieza con su parte de la pausa de retraso, y cuando
 * uno ataca los demás esperan al menos media pausa suya (ver waitTurn). Sin
 * esto último se sincronizaban: con furia la pausa se reduce a la mitad y el
 * retraso inicial pasaba a ser justo una pausa entera.
 *
 * Se le gana bajándole la vida a 0: cada abrechapas quita PLAYER_BULLET.damage.
 */
import type { BossId, EnemyTypeId } from '@pijobeer/shared';
import {
  BOSS,
  BOSS_COMMON,
  BOSS_ENRAGE,
  ENEMY_BULLET,
  HIT_FLASH_STEPS,
  PLAYER_BULLET,
  THROWN,
} from '../config';
import { aimDegrees, clamp, velocityAt, type Point, type Rect } from '../geometry';
import type { Playfield } from '../playfield';
import { Bullet } from './Bullet';
import { Enemy, type RandomFn } from './Enemy';

/** Lo que lanza un jefe en un paso: chorros de espuma y/o botellas. */
export interface BossAttack {
  bullets: Bullet[];
  bottles: Enemy[];
}

const NO_ATTACK: BossAttack = { bullets: [], bottles: [] };

/**
 * Qué está haciendo, para elegir el dibujo (los jefes animados: pijo y primo):
 *   walk     andando de lado; step cuenta los pasos de la animación
 *   windup   cogiendo impulso antes de lanzar
 *   recover  justo después de lanzar
 * progress va de 0 (empieza) a 1 (acaba): con él se elige la pose de cada momento.
 */
export type BossPose =
  { action: 'walk'; step: number } | { action: 'windup' | 'recover'; progress: number };

export interface BossOptions {
  /** Multiplicador de vida (dificultad y truco de admin; 1 = normal). */
  healthScale?: number;
  /** Posición entre los jefes que salen a la vez (0, 1...) y cuántos son. */
  slot?: number;
  count?: number;
  /** Para elegir el tipo de lo que lanza. */
  random?: RandomFn;
  /** Multiplicador de velocidad de lo que lanza (el del nivel). */
  bottleSpeedScale?: number;
}

export class Boss implements Rect {
  readonly width: number;
  readonly height: number;
  readonly maxHealth: number;
  health: number;
  x: number;
  y: number;

  private readonly stats: (typeof BOSS)[BossId];
  private readonly random: RandomFn;
  private readonly bottleSpeedScale: number;
  /** Hacia dónde se mueve: 1 derecha, -1 izquierda. */
  private direction: 1 | -1;
  /** Pasos hasta el siguiente ataque. */
  private fireCooldown: number;
  /** Ataques que quedan en la ráfaga actual. */
  private burstLeft: number;
  /** Pasos que quedan de destello blanco tras recibir un impacto. */
  private flashSteps = 0;
  /** Pasos que quedan hasta poder volver a hacer daño por contacto. */
  private contactCooldown = 0;
  /** Pasos que le quedan quieto tras acabar una ráfaga (recoverSteps). */
  private recoverSteps = 0;
  /** Pasos que lleva andando: marcan el frame de la animación del pijo. */
  private walkSteps = 0;
  /** Pausa que empezó al acabar su última ráfaga (ver turnGap). */
  private lastPause = 0;
  /** Lo que lanzará en su próximo ataque y lo último que ha lanzado (null = solo echa espuma). */
  private nextThrow: EnemyTypeId | null;
  private lastThrow: EnemyTypeId | null = null;

  constructor(
    readonly id: BossId,
    private readonly field: Playfield,
    {
      healthScale = 1,
      slot = 0,
      count = 1,
      random = Math.random,
      bottleSpeedScale = 1,
    }: BossOptions = {},
  ) {
    this.stats = BOSS[id];
    this.width = this.stats.width;
    this.height = this.stats.height;
    this.maxHealth = Math.max(1, Math.round(this.stats.health * healthScale));
    this.health = this.maxHealth;
    // Por turnos: con dos jefes, el segundo ataca a mitad de la pausa del primero
    this.fireCooldown = this.stats.burstPause + Math.round((this.stats.burstPause * slot) / count);
    this.burstLeft = this.stats.burstSize;
    this.random = random;
    this.bottleSpeedScale = bottleSpeedScale;
    this.nextThrow = this.pickThrow();
    // Repartidos a lo ancho (uno solo, centrado) y por encima del borde superior: entran bajando
    const center = field.left + ((field.right - field.left) * (slot + 1)) / (count + 1);
    this.x = center - this.width / 2;
    this.y = -this.height;
    this.direction = slot % 2 === 0 ? 1 : -1;
  }

  get isEntering(): boolean {
    return this.y < BOSS_COMMON.holdY;
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  /** Fase de furia: le queda poca vida (BOSS_ENRAGE.enrageAt). */
  get isEnraged(): boolean {
    return this.health <= this.maxHealth * BOSS_ENRAGE.enrageAt;
  }

  /** true durante el destello: el renderer dibuja la silueta blanca. */
  get isFlashing(): boolean {
    return this.flashSteps > 0;
  }

  get healthPercent(): number {
    return (this.health / this.maxHealth) * 100;
  }

  /**
   * true mientras ataca, y entonces no se mueve: desde windupSteps pasos antes
   * de la ráfaga (cogiendo impulso) hasta recoverSteps pasos después.
   */
  get isAttacking(): boolean {
    if (this.isEntering) return false;
    const inBurst = this.burstLeft < this.stats.burstSize;
    const windingUp = this.fireCooldown <= this.stats.windupSteps;
    return inBurst || windingUp || this.recoverSteps > 0;
  }

  /** Qué está haciendo, para que el renderer elija su pose (ver BossPose). */
  get pose(): BossPose {
    const { windupSteps, recoverSteps } = this.stats;
    if (this.recoverSteps > 0) {
      return { action: 'recover', progress: 1 - this.recoverSteps / recoverSteps };
    }
    if (this.isAttacking) {
      // Sin impulso (los barriles) no hay nada que animar: ya está listo
      const progress = windupSteps > 0 ? 1 - this.fireCooldown / windupSteps : 1;
      return { action: 'windup', progress: clamp(progress, 0, 1) };
    }
    return { action: 'walk', step: Math.floor(this.walkSteps / BOSS_COMMON.walkFrameSteps) };
  }

  /**
   * Lo que tiene en las manos: lo que acaba de lanzar mientras se recupera y,
   * si no, lo próximo que va a lanzar. null si solo echa espuma.
   */
  get heldThrow(): EnemyTypeId | null {
    return this.recoverSteps > 0 ? this.lastThrow : this.nextThrow;
  }

  /** Lo que deben esperar los demás jefes tras un ataque suyo: media pausa, para turnarse a partes iguales. */
  get turnGap(): number {
    return Math.round(this.lastPause / 2);
  }

  /**
   * Acaba de atacar otro jefe: este espera al menos `steps` pasos antes de su
   * siguiente ataque, para no atacar los dos a la vez. No corta una ráfaga ya
   * empezada.
   */
  waitTurn(steps: number): void {
    if (this.isEntering || this.burstLeft < this.stats.burstSize) return;
    this.fireCooldown = Math.max(this.fireCooldown, steps);
  }

  /** Punto por el que sale el ataque: abajo en el centro (el grifo, o las manos del pijo). */
  private get tap(): Point {
    return { x: this.x + this.width / 2, y: this.y + this.height };
  }

  /**
   * Avanza un paso: entra o patrulla, y ataca cuando toca.
   * @param target - a dónde apuntar (el centro del jugador). Sin él, dispara hacia abajo.
   * @returns lo lanzado en este paso (varios chorros si el abanico tiene varios)
   */
  update(target?: Point): BossAttack {
    if (this.flashSteps > 0) this.flashSteps--;
    if (this.contactCooldown > 0) this.contactCooldown--;

    if (this.isEntering) {
      this.y = Math.min(BOSS_COMMON.holdY, this.y + BOSS_COMMON.enterSpeed);
      return NO_ATTACK;
    }

    // Primero corre el tiempo y después se decide si anda: así en el paso en
    // que ataca (fireCooldown llega a 0) ya está quieto
    this.fireCooldown--;
    if (this.recoverSteps > 0) this.recoverSteps--;
    if (!this.isAttacking) this.patrol();
    if (this.fireCooldown > 0) return NO_ATTACK;

    // Ráfaga: dentro de ella, poca espera entre ataques; al acabarla, la pausa larga
    this.burstLeft--;
    if (this.burstLeft > 0) {
      this.fireCooldown = this.stats.burstGap;
    } else {
      this.burstLeft = this.stats.burstSize;
      this.recoverSteps = this.stats.recoverSteps;
      const pauseScale = this.isEnraged ? this.stats.enragedPauseScale : 1;
      this.lastPause = Math.round(this.stats.burstPause * pauseScale);
      this.fireCooldown = this.lastPause;
    }
    return this.attack(target);
  }

  /**
   * Recibe un abrechapas. Mientras entra es invulnerable.
   * @param damage - vida que quita (por defecto, la de un abrechapas)
   * @returns true si el impacto ha contado
   */
  hit(damage: number = PLAYER_BULLET.damage): boolean {
    if (this.isEntering || this.isDead) return false;
    this.health = Math.max(0, this.health - damage);
    this.flashSteps = HIT_FLASH_STEPS;
    return true;
  }

  /**
   * ¿Puede hacer daño por contacto ahora? Si es que sí, arranca el tiempo de
   * espera, para que tocarlo quite vida una vez y no en cada paso.
   */
  tryContactDamage(): boolean {
    if (this.contactCooldown > 0 || this.isEntering) return false;
    this.contactCooldown = BOSS_COMMON.contactCooldown;
    return true;
  }

  /** De lado a lado, dando la vuelta al llegar a una pared. Con furia, más rápido. */
  private patrol(): void {
    this.walkSteps++;
    const speed = this.stats.speed * (this.isEnraged ? BOSS_ENRAGE.speedScale : 1);
    this.x += this.direction * speed;
    const maxX = this.field.right - this.width;
    if (this.x <= this.field.left || this.x >= maxX) {
      this.x = Math.min(Math.max(this.x, this.field.left), maxX);
      this.direction = this.x <= this.field.left ? 1 : -1;
    }
  }

  /** Elige al azar lo próximo que lanzará, entre los tipos de su ataque (null si echa espuma). */
  private pickThrow(): EnemyTypeId | null {
    if (this.stats.attack === 'foam') return null;
    const { types } = THROWN[this.stats.attack];
    return types[Math.floor(this.random() * types.length)]!;
  }

  /**
   * Un ataque. Los que lanzan cosas, lanzan una hacia el jugador (o hacia
   * abajo). Los que echan espuma, `streams` chorros repartidos por igual en
   * un abanico de `spreadDeg` grados, centrado en la dirección del jugador
   * (si apunta) o hacia abajo. Los ángulos se miden desde la vertical: 0 =
   * recto hacia abajo, positivo = hacia la derecha.
   */
  private attack(target?: Point): BossAttack {
    const { stats, isEnraged, tap } = this;

    if (stats.attack !== 'foam' && this.nextThrow) {
      const aim = target ?? { x: tap.x, y: tap.y + 1 };
      const throwing = THROWN[stats.attack];
      const thrown = Enemy.thrownAt(
        this.nextThrow,
        tap,
        aim,
        this.random,
        throwing,
        this.bottleSpeedScale,
      );
      this.lastThrow = this.nextThrow;
      this.nextThrow = this.pickThrow();
      return { bullets: [], bottles: [thrown] };
    }

    const streams = stats.streams + (isEnraged ? stats.enragedExtraStreams : 0);
    const spread = stats.spreadDeg + (isEnraged ? stats.enragedExtraSpreadDeg : 0);
    const center = stats.aimed && target ? aimDegrees(tap, target, BOSS_COMMON.maxAimDeg) : 0;

    const bullets = Array.from({ length: streams }, (_, i) => {
      // Con 5 chorros y 60°: -30, -15, 0, 15, 30 grados alrededor del centro
      const offset = streams > 1 ? (i / (streams - 1) - 0.5) * spread : 0;
      const velocity = velocityAt(center + offset, BOSS_COMMON.bulletSpeed);
      return new Bullet(
        tap.x - ENEMY_BULLET.width / 2,
        tap.y,
        velocity.y,
        ENEMY_BULLET,
        velocity.x,
      );
    });
    return { bullets, bottles: [] };
  }
}
