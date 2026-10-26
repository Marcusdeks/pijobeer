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
 *
 * También lleva la CHUPA (ver JACKET en config.ts): manteniendo la B se tapa
 * con ella y queda quieto; GameSession le avisa con blockShot() de cada
 * chorro que para, y al tercero se empapa y tarda unos segundos en secarse.
 */
import {
  ARENA,
  CAMERA,
  JACKET,
  PICKUP_TYPES,
  PLAYER,
  PLAYER_BULLET,
  type GameAction,
} from '../config';
import { directionFromInput, type Direction } from '../direction';
import { clamp, type Rect } from '../geometry';
import type { InputState } from '../input/InputState';
import type { Playfield } from '../playfield';
import { IDLE_FRAME, STEPS_PER_ANIMATION_FRAME, WALK_CYCLE_LENGTH } from '../sprites/playerSprite';
import { Bullet } from './Bullet';

/** Sin callejón (p. ej. en tests): todo el ancho del área de juego. */
const FULL_WIDTH: Playfield = { left: 0, right: ARENA.width };

/** La única dirección que cuenta como "mirar hacia delante" (hacia el fondo del callejón). */
const FORWARD: Direction = 'arriba';

/** Lo que la partida le dice al jugador en cada paso (ver GameSession y rules.ts). */
export interface PlayerStepOptions {
  /** Suelo del callejón: el jugador no puede meterse en las paredes. */
  field?: Playfield;
  /** Pasos entre disparos según la dificultad. */
  shootCooldown?: number;
  /** Si la partida deja avanzar por el callejón ahora (contra el jefe, no). */
  canAdvance?: boolean;
  /** Si en este nivel se puede usar la chupa. */
  jacketAllowed?: boolean;
}

export class Player implements Rect {
  readonly width = PLAYER.width;
  readonly height = PLAYER.height;
  health: number = PLAYER.maxHealth;

  /** Dirección en la que mira. Empieza hacia arriba, que es hacia donde dispara. */
  facing: Direction = 'arriba';

  /** true si en el último paso se ha movido (decide si se anima o se queda en pose neutra). */
  isMoving = false;

  /**
   * true mientras avanza por el callejón (si la partida lo permite: contra el
   * jefe, no). Mirando recto hacia delante avanza solo, sin pulsar nada: como
   * en una cinta de correr, corre en el sitio y es el callejón el que se mueve
   * (ver CAMERA en config.ts). En diagonal solo avanza mientras se pulsa W.
   * Mirando a un lado o hacia atrás, se para.
   */
  isAdvancing = false;

  /** true si además mantiene pulsado "arriba" (recto): esprinta y las piernas van más rápido. */
  isSprinting = false;

  /** Píxeles que avanza el callejón en este paso (0 = parado). Lo suma GameSession. */
  advanceSpeed = 0;

  /** true mientras se tapa con la chupa: la espuma no le hace daño, pero no puede moverse ni disparar. */
  isShielding = false;

  /** Chorros que aún puede parar la chupa antes de empaparse. */
  private blocksLeft: number = JACKET.maxBlocks;

  /** Pasos que le quedan a la chupa para secarse (0 = seca, lista para usarla). */
  private dryingSteps = 0;

  /** Pasos acumulados andando. Se reinicia al pararse, para empezar siempre el ciclo desde el principio. */
  private walkSteps = 0;

  /** Pasos que faltan para poder volver a disparar. */
  private shootCooldown = 0;

  /** Pasos que le quedan al disparo rápido de la lata de velocidad (0 = sin él). */
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

  /** Porcentaje que queda del disparo rápido de la lata de velocidad (0 = sin él). Lo usa el renderer para su barra. */
  get boostPercent(): number {
    return (this.boostSteps / PICKUP_TYPES.speed.durationSteps) * 100;
  }

  /** Porcentaje que le falta a la chupa para secarse (0 = seca). Lo usa el renderer para su barra. */
  get dryingPercent(): number {
    return (this.dryingSteps / JACKET.dryingSteps) * 100;
  }

  /**
   * Columna de la hoja de sprites que toca dibujar ahora.
   * Quieto: siempre la pose neutra. Andando o avanzando por el callejón
   * (corriendo en el sitio): avanza un frame cada STEPS_PER_ANIMATION_FRAME
   * pasos y vuelve a empezar al terminar el ciclo.
   */
  get animationFrame(): number {
    if (!this.isMoving && !this.isAdvancing) return IDLE_FRAME;
    return Math.floor(this.walkSteps / STEPS_PER_ANIMATION_FRAME) % WALK_CYCLE_LENGTH;
  }

  /**
   * Avanza un paso: mueve según las teclas pulsadas, actualiza la animación
   * y dispara si toca. Tapado con la chupa, se queda quieto y no dispara.
   * @returns la bala disparada en este paso, o null si no ha disparado
   */
  update(
    input: InputState,
    {
      field = FULL_WIDTH,
      shootCooldown = PLAYER.shootCooldown,
      canAdvance = false,
      jacketAllowed = false,
    }: PlayerStepOptions = {},
  ): Bullet | null {
    if (this.dryingSteps > 0) this.dryingSteps--;
    this.isShielding = jacketAllowed && this.dryingSteps === 0 && input.isDown('shield');
    // Con las manos en la chupa no se mueve ni dispara: como si no pulsara nada más
    const isDown = (action: GameAction) => !this.isShielding && input.isDown(action);

    // -1, 0 o 1 en cada eje. Si se pulsan dos teclas opuestas a la vez se anulan.
    const dx = Number(isDown('right')) - Number(isDown('left'));
    const dy = Number(isDown('down')) - Number(isDown('up'));

    this.x += dx * PLAYER.speed;
    this.y += dy * PLAYER.speed;

    // A los lados, las paredes del callejón. Arriba, como mucho media pantalla.
    this.x = clamp(this.x, field.left, field.right - this.width);
    this.y = clamp(this.y, PLAYER.minY, ARENA.height - this.height);

    // Tapado tampoco avanza el callejón: está parado aunque mire hacia delante
    this.updateAnimation(dx, dy, canAdvance && !this.isShielding);

    if (this.shootCooldown > 0) this.shootCooldown--;
    const boosted = this.boostSteps > 0;
    if (boosted) this.boostSteps--;

    if (isDown('shoot') && this.shootCooldown === 0) {
      // Con la lata de velocidad, la espera entre disparos se divide
      this.shootCooldown = boosted
        ? Math.round(shootCooldown / PICKUP_TYPES.speed.fireRateScale)
        : shootCooldown;
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

  /**
   * La chupa ha parado un chorro de espuma. Al llegar a JACKET.maxBlocks se
   * empapa: se la quita (deja de proteger ya en este paso) y empieza a secarse.
   */
  blockShot(): void {
    this.blocksLeft--;
    if (this.blocksLeft > 0) return;
    this.blocksLeft = JACKET.maxBlocks;
    this.dryingSteps = JACKET.dryingSteps;
    this.isShielding = false;
  }

  /** Empieza el disparo rápido. Otra lata mientras dura lo renueva, no lo acumula. */
  boost(): void {
    this.boostSteps = PICKUP_TYPES.speed.durationSteps;
  }

  private updateAnimation(dx: number, dy: number, canAdvance: boolean): void {
    const direction = directionFromInput(dx, dy);

    // Al soltar las teclas NO se cambia "facing": el personaje se queda
    // mirando hacia donde iba, que es lo natural. Por eso, si lo último fue
    // ir hacia delante, sigue avanzando sin pulsar nada.
    if (direction !== null) this.facing = direction;
    this.isMoving = direction !== null;

    // Con W pulsada (recta o en diagonal) avanza mientras se pulse. Sin pulsar
    // nada, solo sigue avanzando (cinta de correr) si se quedó mirando recto.
    const pushing = dy < 0;
    this.isAdvancing = canAdvance && (pushing || (direction === null && this.facing === FORWARD));
    this.isSprinting = this.isAdvancing && direction === FORWARD;
    this.advanceSpeed = this.isAdvancing ? this.strideSpeed(pushing, dx !== 0) : 0;

    // Andando o corriendo en el sitio, el ciclo sigue (al esprintar, al doble de
    // velocidad: las piernas van más rápido); parado, vuelve al principio
    if (this.isSprinting) this.walkSteps += 2;
    else if (this.isMoving || this.isAdvancing) this.walkSteps++;
    else this.walkSteps = 0;
  }

  /** Píxeles por paso que avanza el callejón cuando el jugador avanza (ver CAMERA en config.ts). */
  private strideSpeed(pushing: boolean, diagonal: boolean): number {
    if (!pushing) return CAMERA.advanceSpeed;
    // Pegado a media pantalla ya no puede subir más: lo que corre es el callejón
    const speed = this.y === PLAYER.minY ? CAMERA.lineSpeed : CAMERA.sprintSpeed;
    return diagonal ? speed * CAMERA.diagonalScale : speed;
  }
}
