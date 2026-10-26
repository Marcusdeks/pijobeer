/**
 * JEFE FINAL: un barril de cerveza pija.
 *
 *   1. ENTRADA: baja desde fuera de la pantalla hasta BOSS_COMMON.holdY. Mientras
 *      entra ni dispara ni se le puede dañar (aún no ha empezado el combate).
 *   2. COMBATE: se queda a esa altura (no avanza hacia el jugador), va de pared
 *      a pared y dispara en RÁFAGAS. Cada disparo es un abanico de chorros que
 *      puede apuntar al jugador (ver BOSS en config.ts).
 *   3. FURIA: cuando le queda un 20 % de vida se mueve más rápido, descansa
 *      menos y añade chorros al abanico (ver BOSS_ENRAGE).
 *
 * Se le gana bajándole la vida a 0: cada abrechapas que le acierta quita 1.
 */
import type { BossId } from '@pijobeer/shared';
import { BOSS, BOSS_COMMON, BOSS_ENRAGE, ENEMY_BULLET } from '../config';
import { aimDegrees, velocityAt, type Point, type Rect } from '../geometry';
import type { Playfield } from '../playfield';
import { Bullet } from './Bullet';

export class Boss implements Rect {
  readonly width: number;
  readonly height: number;
  readonly maxHealth: number;
  health: number;
  x: number;
  y: number;

  private readonly stats: (typeof BOSS)[BossId];
  /** Hacia dónde se mueve: 1 derecha, -1 izquierda. */
  private direction: 1 | -1 = 1;
  /** Pasos hasta el siguiente disparo. */
  private fireCooldown: number;
  /** Disparos que quedan en la ráfaga actual. */
  private burstLeft: number;
  /** Pasos que quedan de destello blanco tras recibir un impacto. */
  private flashSteps = 0;
  /** Pasos que quedan hasta poder volver a hacer daño por contacto. */
  private contactCooldown = 0;

  /**
   * @param healthScale - multiplicador de vida (truco de admin; 1 = normal)
   */
  constructor(
    readonly id: BossId,
    private readonly field: Playfield,
    healthScale = 1,
  ) {
    this.stats = BOSS[id];
    this.width = this.stats.width;
    this.height = this.stats.height;
    this.maxHealth = Math.max(1, Math.round(this.stats.health * healthScale));
    this.health = this.maxHealth;
    this.fireCooldown = this.stats.burstPause;
    this.burstLeft = this.stats.burstSize;
    // Centrado y por encima del borde superior: entra bajando
    this.x = (field.left + field.right) / 2 - this.width / 2;
    this.y = -this.height;
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

  /** Punto por el que sale la espuma: el grifo, abajo en el centro. */
  private get tap(): Point {
    return { x: this.x + this.width / 2, y: this.y + this.height };
  }

  /**
   * Avanza un paso: entra o patrulla, y dispara cuando toca.
   * @param target - a dónde apuntar (el centro del jugador). Sin él, dispara hacia abajo.
   * @returns las balas disparadas en este paso (varias si el abanico tiene varios chorros)
   */
  update(target?: Point): Bullet[] {
    if (this.flashSteps > 0) this.flashSteps--;
    if (this.contactCooldown > 0) this.contactCooldown--;

    if (this.isEntering) {
      this.y = Math.min(BOSS_COMMON.holdY, this.y + BOSS_COMMON.enterSpeed);
      return [];
    }

    this.patrol();
    if (--this.fireCooldown > 0) return [];

    // Ráfaga: dentro de ella, poca espera entre disparos; al acabarla, la pausa larga
    this.burstLeft--;
    if (this.burstLeft > 0) {
      this.fireCooldown = this.stats.burstGap;
    } else {
      this.burstLeft = this.stats.burstSize;
      const pauseScale = this.isEnraged ? BOSS_ENRAGE.pauseScale : 1;
      this.fireCooldown = Math.round(this.stats.burstPause * pauseScale);
    }
    return this.fan(target);
  }

  /**
   * Recibe un impacto. Mientras entra es invulnerable.
   * @returns true si el impacto ha contado
   */
  hit(): boolean {
    if (this.isEntering || this.isDead) return false;
    this.health--;
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
    const speed = this.stats.speed * (this.isEnraged ? BOSS_ENRAGE.speedScale : 1);
    this.x += this.direction * speed;
    const maxX = this.field.right - this.width;
    if (this.x <= this.field.left || this.x >= maxX) {
      this.x = Math.min(Math.max(this.x, this.field.left), maxX);
      this.direction = this.x <= this.field.left ? 1 : -1;
    }
  }

  /**
   * Un disparo: `streams` chorros repartidos por igual en un abanico de
   * `spreadDeg` grados, centrado en la dirección del jugador (si apunta) o
   * hacia abajo. Los ángulos se miden desde la vertical: 0 = recto hacia
   * abajo, positivo = hacia la derecha.
   */
  private fan(target?: Point): Bullet[] {
    const { stats, isEnraged } = this;
    const streams = stats.streams + (isEnraged ? stats.enragedExtraStreams : 0);
    const spread = stats.spreadDeg + (isEnraged ? stats.enragedExtraSpreadDeg : 0);
    const { tap } = this;
    const center = this.stats.aimed && target ? aimDegrees(tap, target, BOSS_COMMON.maxAimDeg) : 0;

    return Array.from({ length: streams }, (_, i) => {
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
  }
}
