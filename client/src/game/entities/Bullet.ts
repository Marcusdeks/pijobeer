/**
 * BALA: la usan el jugador (abrechapas en llamas), las botellas y los jefes
 * (chorro de espuma).
 *
 * Avanza en línea recta con una velocidad (velocityX, velocityY) hasta
 * impactar o salir de la pantalla. La mayoría van en vertical (velocityX = 0);
 * los jefes también disparan en diagonal (apuntando al jugador o en abanico).
 *
 * Las entidades del motor solo contienen ESTADO y LÓGICA: no saben dibujarse
 * (de eso se encarga renderer.ts), así que se pueden probar sin canvas.
 */
import { ARENA } from '../config';
import type { Rect } from '../geometry';

export interface BulletSize {
  width: number;
  height: number;
}

export class Bullet implements Rect {
  readonly width: number;
  readonly height: number;
  /** false cuando ha impactado: se elimina al final del paso. */
  alive = true;
  /** Pasos que lleva en vuelo. El renderer lo usa para elegir el frame de su animación. */
  age = 0;

  /**
   * @param velocityY - píxeles por paso en vertical. Negativo = sube (jugador), positivo = baja.
   * @param velocityX - píxeles por paso en horizontal (0 = recta hacia arriba o abajo).
   */
  constructor(
    public x: number,
    public y: number,
    readonly velocityY: number,
    size: BulletSize,
    readonly velocityX = 0,
  ) {
    this.width = size.width;
    this.height = size.height;
  }

  update(): void {
    this.x += this.velocityX;
    this.y += this.velocityY;
    this.age++;
  }

  /** true si ya salió del área visible por cualquier lado. */
  isOutOfBounds(arenaHeight: number): boolean {
    return (
      this.y + this.height < 0 ||
      this.y > arenaHeight ||
      this.x + this.width < 0 ||
      this.x > ARENA.width
    );
  }
}
