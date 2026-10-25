/**
 * BUCLE DEL JUEGO con "paso de tiempo fijo" (fixed timestep).
 *
 * EL PROBLEMA DEL ORIGINAL:
 *   juego.js movía todo un poco en CADA fotograma de requestAnimationFrame.
 *   Pero el navegador pide tantos fotogramas como Hz tenga el monitor:
 *     - Monitor de 60 Hz  -> 60 actualizaciones/s  -> velocidad normal
 *     - Monitor de 144 Hz -> 144 actualizaciones/s -> el juego va 2,4 veces más rápido
 *     - Portátil saturado a 30 fps -> el juego va a cámara lenta
 *   (Esa es una de las causas de que "el juego vaya más lento" en unos equipos que en otros).
 *
 * LA SOLUCIÓN:
 *   Separamos SIMULAR de DIBUJAR. Medimos cuánto tiempo real ha pasado y
 *   ejecutamos tantos pasos de 1/60 s como quepan en ese tiempo:
 *     - A 144 Hz, la mayoría de fotogramas no ejecutan ningún paso (solo redibujan).
 *     - A 30 fps, cada fotograma ejecuta dos pasos.
 *   Resultado: el juego avanza SIEMPRE a 60 pasos por segundo reales.
 *
 *   El tiempo sobrante (menos de un paso) se guarda en "accumulator" para
 *   el siguiente fotograma, así no se pierde ni se gana tiempo con el redondeo.
 */
import { SIMULATION_STEPS_PER_SECOND } from './config';

const STEP_MS = 1000 / SIMULATION_STEPS_PER_SECOND;

/**
 * Máximo de tiempo que se recupera de golpe. Si la pestaña estuvo en segundo
 * plano 10 segundos, el navegador no llama al bucle; al volver, sin este
 * límite se simularían 600 pasos de golpe y el jugador moriría sin ver nada.
 */
const MAX_FRAME_MS = 250;

export class GameLoop {
  private frameId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;

  constructor(
    /** Avanza la simulación UN paso fijo. */
    private readonly update: () => void,
    /** Dibuja el estado actual. Se llama una vez por fotograma. */
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.frameId !== null) return; // ya estaba en marcha
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.frameId = requestAnimationFrame(this.tick);
  }

  /** Detiene el bucle. Hay que llamarlo al salir de la pantalla de juego. */
  stop(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private readonly tick = (now: number): void => {
    const elapsed = Math.min(now - this.lastTime, MAX_FRAME_MS);
    this.lastTime = now;
    this.accumulator += elapsed;

    while (this.accumulator >= STEP_MS) {
      this.update();
      this.accumulator -= STEP_MS;
    }

    this.render();
    this.frameId = requestAnimationFrame(this.tick);
  };
}
