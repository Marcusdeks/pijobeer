/**
 * LATA (objeto que se recoge).
 *
 * Cae en línea recta, más despacio que las botellas, y no dispara ni hace
 * daño. Su efecto (curar o acelerar) no está aquí sino en GameSession,
 * que es quien conoce las reglas de la partida (p. ej. cuánto cura según
 * la dificultad); la lata solo sabe de qué TIPO es.
 */
import { PICKUP, type PickupTypeId } from '../config';
import type { Rect } from '../geometry';
import type { Playfield } from '../playfield';
import type { RandomFn } from './Enemy';

export class Pickup implements Rect {
  readonly width = PICKUP.width;
  readonly height = PICKUP.height;
  /** false cuando el jugador la ha recogido: se retira al final del paso. */
  alive = true;

  constructor(
    public x: number,
    public y: number,
    readonly type: PickupTypeId,
  ) {}

  /** Igual que las botellas: X aleatoria del suelo, justo por encima de la vista. */
  static spawn(type: PickupTypeId, field: Playfield, random: RandomFn): Pickup {
    const x = field.left + random() * (field.right - field.left - PICKUP.width);
    return new Pickup(x, -PICKUP.height, type);
  }

  update(): void {
    this.y += PICKUP.fallSpeed;
  }

  /** true si ha caído del todo sin que nadie la recoja. */
  isOutOfBounds(arenaHeight: number): boolean {
    return this.y > arenaHeight;
  }
}
