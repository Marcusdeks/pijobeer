/**
 * CERVEZA QUE CURA: la que lanzan las chicas del despacho (nivel 6) a su
 * alcalde cuando le falta vida (ver CITY_HALL.office.heal).
 *
 * Va recta hacia donde estaba él al lanzarla, sin cambiar de rumbo (como todo
 * lo que se lanza en el juego). Si le llega, le cura; si el jugador la rompe
 * antes de un abrechapas, no. Al jugador no le hace nada: no es para él.
 *
 * No es un Enemy: ni dispara, ni da puntos, ni hace daño. Mezclarla con los
 * enemigos obligaría a llenar Enemy de excepciones; así cada clase hace una cosa.
 */
import { ARENA, ENEMY } from '../config';
import { directionDegrees, velocityAt, type Point, type Rect } from '../geometry';

export class HealingBeer implements Rect {
  /** Su caja: la de una botella. */
  readonly width = ENEMY.width;
  readonly height = ENEMY.height;
  x: number;
  y: number;
  alive = true;
  /** Hacia dónde va, en grados desde la vertical hacia abajo (para girar el dibujo, como las botellas lanzadas). */
  readonly heading: number;

  private readonly velocity: Point;

  /**
   * @param from - de dónde sale (las manos de la chica)
   * @param target - a dónde va (el centro del alcalde)
   * @param speed - píxeles por paso
   */
  constructor(from: Point, target: Point, speed: number) {
    this.x = from.x - this.width / 2;
    this.y = from.y - this.height / 2;
    // En cualquier dirección: el alcalde puede estar a un lado, más abajo o más arriba
    this.heading = directionDegrees(from, target);
    this.velocity = velocityAt(this.heading, speed);
  }

  update(): void {
    this.x += this.velocity.x;
    this.y += this.velocity.y;
  }

  /** Fuera de la pantalla (si el alcalde se ha movido y ha fallado). */
  isOutOfBounds(arenaHeight: number): boolean {
    return (
      this.y > arenaHeight ||
      this.y + this.height < 0 ||
      this.x + this.width < 0 ||
      this.x > ARENA.width
    );
  }
}
