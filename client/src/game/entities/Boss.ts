/**
 * JEFE FINAL: un barril de cerveza pija (madera o hierro) o un pijo.
 *
 *   1. ENTRADA: baja desde fuera de la pantalla hasta BOSS_COMMON.holdY. Mientras
 *      entra ni ataca ni se le puede dañar (aún no ha empezado el combate).
 *   2. COMBATE: se queda a esa altura (no avanza hacia el jugador), va de pared
 *      a pared y ataca en RÁFAGAS (ver BOSS en config.ts). Mientras ataca se
 *      para (ver isAttacking):
 *        - los barriles disparan abanicos de chorros que pueden apuntar al jugador;
 *        - el pijo lanza botellas hacia donde está él (ver Enemy.thrownAt).
 *   3. FURIA: cuando le queda un 20 % de vida se mueve más rápido y cambia su
 *      ritmo de ataque (ver BOSS_ENRAGE y los enraged* de cada jefe).
 *
 * Puede haber varios a la vez (en el nivel 4, dos pijos): cada uno empieza en
 * su hueco del callejón, los vecinos salen en direcciones opuestas y atacan
 * por turnos (cada uno empieza con su parte de la pausa de retraso).
 *
 * Se le gana bajándole la vida a 0: cada abrechapas quita PLAYER_BULLET.damage.
 */
import type { BossId, EnemyTypeId } from '@pijobeer/shared';
import { BOSS, BOSS_COMMON, BOSS_ENRAGE, ENEMY_BULLET, PLAYER_BULLET } from '../config';
import { aimDegrees, velocityAt, type Point, type Rect } from '../geometry';
import type { Playfield } from '../playfield';
import { Bullet } from './Bullet';
import { Enemy, type RandomFn } from './Enemy';

/** Lo que lanza un jefe en un paso: chorros de espuma y/o botellas. */
export interface BossAttack {
  bullets: Bullet[];
  bottles: Enemy[];
}

/** Las botellas que lanza el pijo: de cualquier tipo, al azar. */
const THROWN_TYPES: readonly EnemyTypeId[] = ['normal', 'fast', 'heavy'];

const NO_ATTACK: BossAttack = { bullets: [], bottles: [] };

export interface BossOptions {
  /** Multiplicador de vida (dificultad y truco de admin; 1 = normal). */
  healthScale?: number;
  /** Posición entre los jefes que salen a la vez (0, 1...) y cuántos son. */
  slot?: number;
  count?: number;
  /** Para elegir el tipo de las botellas lanzadas. */
  random?: RandomFn;
  /** Multiplicador de velocidad de las botellas lanzadas (el del nivel). */
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

  /**
   * Pose que toca dibujar (la usa el renderer con la hoja del pijo):
   *   'windup' brazo arriba con la botella, a punto de lanzarla
   *   'throw'  brazo estirado, recién lanzada
   *   0 o 1    los dos pasos al andar de lado
   */
  get pose(): 'windup' | 'throw' | 0 | 1 {
    if (this.recoverSteps > 0) return 'throw';
    if (this.isAttacking) return 'windup';
    return Math.floor(this.walkSteps / BOSS_COMMON.walkFrameSteps) % 2 === 0 ? 0 : 1;
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
      this.fireCooldown = Math.round(this.stats.burstPause * pauseScale);
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
    this.flashSteps = BOSS_COMMON.hitFlashSteps;
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

  /**
   * Un ataque: `streams` chorros (o botellas) repartidos por igual en un
   * abanico de `spreadDeg` grados, centrado en la dirección del jugador (si
   * apunta) o hacia abajo. Los ángulos se miden desde la vertical: 0 = recto
   * hacia abajo, positivo = hacia la derecha.
   */
  private attack(target?: Point): BossAttack {
    const { stats, isEnraged, tap } = this;

    if (stats.attack === 'bottles') {
      const aim = target ?? { x: tap.x, y: tap.y + 1 };
      const bottles = Array.from({ length: stats.streams }, () => {
        const type = THROWN_TYPES[Math.floor(this.random() * THROWN_TYPES.length)]!;
        return Enemy.thrownAt(type, tap, aim, this.random, this.bottleSpeedScale);
      });
      return { bullets: [], bottles };
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
