/**
 * Entrada por teclado: traduce teclas físicas a acciones del juego.
 *
 * Mejoras respecto al controles.js original:
 *   - Los listeners se QUITAN al salir de la pantalla de juego (detach). Antes
 *     se quedaban escuchando para siempre, aunque no hubiera partida.
 *   - Si la ventana pierde el foco (Alt+Tab) con una tecla pulsada, el navegador
 *     nunca envía su "keyup" y el jugador se quedaba moviéndose solo. Ahora,
 *     al perder el foco, se sueltan todas las teclas.
 *   - Las acciones de "una pulsación" (pausa) se notifican aparte con onPress,
 *     ignorando la repetición automática al mantener la tecla.
 */
import { CONTROLS, type GameAction } from '../config';
import type { InputState } from './InputState';

/** Mapa inverso de CONTROLS: { 'a': 'left', 'd': 'right', ... } */
const ACTION_BY_KEY = new Map<string, GameAction>(
  (Object.entries(CONTROLS) as Array<[GameAction, string]>).map(([action, key]) => [key, action]),
);

export class KeyboardInput implements InputState {
  private readonly pressed = new Set<GameAction>();

  /**
   * @param onPress - se llama UNA vez por pulsación real (sin auto-repetición).
   *   Lo usa la pantalla de juego para la pausa.
   */
  constructor(private readonly onPress?: (action: GameAction) => void) {}

  isDown(action: GameAction): boolean {
    return this.pressed.has(action);
  }

  /** Empieza a escuchar el teclado. */
  attach(target: Window = window): void {
    target.addEventListener('keydown', this.handleKeyDown);
    target.addEventListener('keyup', this.handleKeyUp);
    target.addEventListener('blur', this.releaseAll);
  }

  /** Deja de escuchar. IMPRESCINDIBLE llamarlo al desmontar, o quedarían listeners "fantasma". */
  detach(target: Window = window): void {
    target.removeEventListener('keydown', this.handleKeyDown);
    target.removeEventListener('keyup', this.handleKeyUp);
    target.removeEventListener('blur', this.releaseAll);
    this.releaseAll();
  }

  /* Los manejadores son funciones flecha guardadas en propiedades para que
     "this" apunte siempre a esta instancia, y para poder pasar EXACTAMENTE la
     misma función a removeEventListener (si no, no se podrían quitar). */

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    // No capturamos teclas mientras se escribe en un formulario
    if (isTypingInField(event.target)) return;

    const action = ACTION_BY_KEY.get(event.key.toLowerCase());
    if (!action) return;

    this.pressed.add(action);
    if (!event.repeat) this.onPress?.(action);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const action = ACTION_BY_KEY.get(event.key.toLowerCase());
    if (action) this.pressed.delete(action);
  };

  private readonly releaseAll = (): void => {
    this.pressed.clear();
  };
}

function isTypingInField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
