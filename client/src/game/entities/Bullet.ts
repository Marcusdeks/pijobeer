/**
 * BALA: la usan tanto el jugador (abrechapas en llamas) como los enemigos
 * (chorro de espuma). Las dos se comportan igual: avanzan en vertical hasta
 * impactar o salir de la pantalla. Lo único que cambia es su tamaño, su
 * velocidad y su dibujo, y de lo último se encarga el renderer según la
 * lista en la que esté la bala.
 *
 * Las entidades del motor (Bullet, Player, Enemy) solo contienen ESTADO y
 * LÓGICA. No saben dibujarse: de eso se encarga renderer.ts. Así la lógica
 * se puede probar en tests sin ningún canvas.
 */
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

  constructor(
    public x: number,
    public y: number,
    /** Píxeles por paso. Negativo = sube (jugador). Positivo = baja (enemigo). */
    private readonly velocityY: number,
    size: BulletSize,
  ) {
    this.width = size.width;
    this.height = size.height;
  }

  update(): void {
    this.y += this.velocityY;
    this.age++;
  }

  /** true si ya salió del área visible por arriba o por abajo. */
  isOutOfBounds(arenaHeight: number): boolean {
    return this.y + this.height < 0 || this.y > arenaHeight;
  }
}
