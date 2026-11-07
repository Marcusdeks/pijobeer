/**
 * CHICA DE LA FIESTA de la planta baja del ayuntamiento (nivel 6).
 *
 * Es decorado con vida: no choca con nada y las balas la atraviesan. Pasa por
 * tres momentos, cada uno con su animación:
 *
 *   dance ──(alarma: scare)──► scared ──(CITY_HALL.dancer.scaredSteps)──► run ──► desaparece
 *
 * Al huir corre en línea recta hasta su salida (CITY_HALL.hall.dancers) y allí
 * se desvanece. Desde el susto grita (el renderer le pinta un bocadillo: ver
 * isShouting). Si sale por una puerta (viaDoor), la puerta se va abriendo
 * mientras llega (se ve oscura por dentro), ella se desvanece en lo oscuro y
 * después la puerta se cierra; hasta entonces no se da por ida.
 *
 * Qué dibujo toca en cada momento lo decide sprites/sheets.ts.
 */
import { CITY_HALL, type DancerGirl } from '../config';
import { clamp, type Point } from '../geometry';

export type DancerAction = 'dance' | 'scared' | 'run';

const { scaredSteps, runSpeed, fadeSteps } = CITY_HALL.dancer;
const { swingSteps } = CITY_HALL.hall.exitDoor;

/** Distancia a la puerta desde la que empieza a abrirla: la que recorre mientras se abre. */
const OPEN_FROM = runSpeed * swingSteps;

export class Dancer {
  action: DancerAction = 'dance';
  /** Pasos que lleva en la acción actual: marcan el frame de su animación. */
  steps: number;
  /** 1 = se la ve entera; baja a 0 al llegar a su salida. */
  opacity = 1;

  /** Pasos que lleva cerrándose la puerta, ya con ella dentro. */
  private closingSteps = 0;

  /**
   * @param x, y - dónde tiene los pies
   * @param exit - hacia dónde huye
   * @param viaDoor - si su salida es la puerta del lateral (CITY_HALL.hall.exitDoor)
   * @param phase - pasos de baile adelantados, para que no bailen todas a la vez
   */
  constructor(
    readonly girl: DancerGirl,
    public x: number,
    public y: number,
    private readonly exit: Point,
    readonly viaDoor = false,
    phase = 0,
  ) {
    this.steps = phase;
  }

  /** Ya se ha ido (y, si salía por la puerta, ya se ha cerrado): se puede retirar. */
  get isGone(): boolean {
    return this.opacity <= 0 && (!this.viaDoor || this.closingSteps >= swingSteps);
  }

  /** Grita desde que se asusta hasta que desaparece. */
  get isShouting(): boolean {
    return this.action !== 'dance' && this.opacity > 0;
  }

  /**
   * Cuánto está abierta su puerta: 0 cerrada, 1 abierta del todo. Se abre
   * mientras ella se acerca, sigue abierta mientras desaparece y después se
   * cierra. Sin puerta, siempre 0.
   */
  get doorOpen(): number {
    if (!this.viaDoor || this.action !== 'run') return 0;
    if (this.opacity <= 0) return 1 - this.closingSteps / swingSteps;
    return clamp(1 - this.distanceToExit / OPEN_FROM, 0, 1);
  }

  /** Ha saltado la alarma: deja de bailar y se asusta (solo la primera vez). */
  scare(): void {
    if (this.action !== 'dance') return;
    this.action = 'scared';
    this.steps = 0;
  }

  update(): void {
    this.steps++;
    if (this.action === 'scared' && this.steps >= scaredSteps) {
      this.action = 'run';
      this.steps = 0;
    }
    if (this.action !== 'run') return;

    const distance = this.distanceToExit;
    if (distance > runSpeed) {
      this.x += ((this.exit.x - this.x) / distance) * runSpeed;
      this.y += ((this.exit.y - this.y) / distance) * runSpeed;
    } else if (this.opacity > 0) {
      // En la salida: se desvanece (en lo oscuro de la puerta, o ya fuera de la pantalla)
      this.x = this.exit.x;
      this.y = this.exit.y;
      this.opacity = Math.max(0, this.opacity - 1 / fadeSteps);
    } else if (this.viaDoor) {
      this.closingSteps++;
    }
  }

  private get distanceToExit(): number {
    return Math.hypot(this.exit.x - this.x, this.exit.y - this.y);
  }
}
