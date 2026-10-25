/**
 * JUGADOR: el protagonista.
 *
 * Además de la posición y la vida, guarda el estado de su ANIMACIÓN:
 *   - facing: hacia dónde mira (una de las 8 direcciones).
 *   - walkSteps: cuánto tiempo lleva andando, para saber qué frame del ciclo toca.
 *
 * Es estado de juego como cualquier otro, por eso vive aquí y no en el
 * renderer: el renderer solo pregunta "¿qué frame dibujo?" (animationFrame).
 * Así la animación también se puede probar en tests sin dibujar nada.
 */
import { ARENA, PICKUP_TYPES, PLAYER, PLAYER_BULLET } from '../config';
import { directionFromInput, type Direction } from '../direction';
import { clamp, type Rect } from '../geometry';
import type { InputState } from '../input/InputState';
import type { Playfield } from '../playfield';
import { IDLE_FRAME, STEPS_PER_ANIMATION_FRAME, WALK_CYCLE_LENGTH } from '../sprites/playerSprite';
import { Bullet } from './Bullet';

/** Sin callejón (p. ej. en tests): todo el ancho del área de juego. */
const FULL_WIDTH: Playfield = { left: 0, right: ARENA.width };

export class Player implements Rect {
  readonly width = PLAYER.width;
  readonly height = PLAYER.height;
  health: number = PLAYER.maxHealth;

  /** Dirección en la que mira. Empieza hacia arriba, que es hacia donde dispara. */
  facing: Direction = 'arriba';

  /**
   * Píxeles que ha intentado avanzar hacia arriba en el último paso (negativo
   * = hacia abajo). Es la INTENCIÓN, no lo que se ha movido de verdad: pegado
   * al borde de arriba y pulsando arriba, el personaje no se mueve pero sigue
   * "andando" por el callejón, y el fondo debe seguir avanzando.
   */
  forwardMotion = 0;

  /** true si en el último paso se ha movido (decide si se anima o se queda en pose neutra). */
  isMoving = false;

  /** Pasos acumulados andando. Se reinicia al pararse, para empezar siempre el ciclo desde el principio. */
  private walkSteps = 0;

  /** Pasos que faltan para poder volver a disparar. */
  private shootCooldown = 0;

  /** Pasos que le quedan al acelerón de la lata de velocidad (0 = sin acelerón). */
  private boostSteps = 0;

  constructor(
    public x: number,
    public y: number,
  ) {}

  /** Crea al jugador centrado abajo del todo, como al empezar cada partida. */
  static spawn(): Player {
    return new Player(ARENA.width / 2 - PLAYER.width / 2, ARENA.height - PLAYER.spawnBottomOffset);
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  /** Porcentaje de vida restante (0-100). Lo usa el renderer para la barra de vida. */
  get healthPercent(): number {
    return (this.health / PLAYER.maxHealth) * 100;
  }

  /** Porcentaje que queda del acelerón (0 = sin acelerón). Lo usa el renderer para su barra. */
  get boostPercent(): number {
    return (this.boostSteps / PICKUP_TYPES.speed.durationSteps) * 100;
  }

  /**
   * Columna de la hoja de sprites que toca dibujar ahora.
   * Quieto: siempre la pose neutra. Andando: avanza un frame cada
   * STEPS_PER_ANIMATION_FRAME pasos y vuelve a empezar al terminar el ciclo.
   */
  get animationFrame(): number {
    if (!this.isMoving) return IDLE_FRAME;
    return Math.floor(this.walkSteps / STEPS_PER_ANIMATION_FRAME) % WALK_CYCLE_LENGTH;
  }

  /**
   * Avanza un paso: mueve según las teclas pulsadas, actualiza la animación
   * y dispara si toca.
   * @param field - suelo del callejón: el jugador no puede meterse en las paredes
   * @returns la bala disparada en este paso, o null si no ha disparado
   */
  update(input: InputState, field: Playfield = FULL_WIDTH): Bullet | null {
    // -1, 0 o 1 en cada eje. Si se pulsan dos teclas opuestas a la vez se anulan.
    const dx = Number(input.isDown('right')) - Number(input.isDown('left'));
    const dy = Number(input.isDown('down')) - Number(input.isDown('up'));

    const speed = this.boostSteps > 0 ? PLAYER.speed * PICKUP_TYPES.speed.speedScale : PLAYER.speed;
    if (this.boostSteps > 0) this.boostSteps--;
    this.x += dx * speed;
    this.y += dy * speed;
    this.forwardMotion = -dy * speed;

    // A los lados, las paredes del callejón. Arriba, sitio para la cabeza y la barra de vida.
    this.x = clamp(this.x, field.left, field.right - this.width);
    this.y = clamp(this.y, PLAYER.topMargin, ARENA.height - this.height);

    this.updateAnimation(dx, dy);

    if (this.shootCooldown > 0) this.shootCooldown--;

    if (input.isDown('shoot') && this.shootCooldown === 0) {
      this.shootCooldown = PLAYER.shootCooldown;
      // El abrechapas sale centrado sobre el jugador, hacia arriba (velocidad negativa)
      const bulletX = this.x + this.width / 2 - PLAYER_BULLET.width / 2;
      const bulletY = this.y - PLAYER_BULLET.height;
      return new Bullet(bulletX, bulletY, -PLAYER_BULLET.speed, PLAYER_BULLET);
    }

    return null;
  }

  /** Resta vida, sin bajar de 0. */
  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  /** Suma vida, sin pasar del máximo. */
  heal(amount: number): void {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount);
  }

  /** Empieza el acelerón. Otra lata durante el acelerón lo renueva, no lo acumula. */
  boost(): void {
    this.boostSteps = PICKUP_TYPES.speed.durationSteps;
  }

  private updateAnimation(dx: number, dy: number): void {
    const direction = directionFromInput(dx, dy);

    // Al soltar las teclas NO se cambia "facing": el personaje se queda
    // mirando hacia donde iba, que es lo natural.
    if (direction === null) {
      this.isMoving = false;
      this.walkSteps = 0;
      return;
    }

    this.facing = direction;
    this.isMoving = true;
    this.walkSteps++;
  }
}
