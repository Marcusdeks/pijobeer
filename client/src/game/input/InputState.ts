/**
 * Contrato de "qué acciones están activas ahora mismo".
 *
 * El motor no pregunta por teclas concretas ("¿está pulsada la W?") sino por
 * ACCIONES ("¿quiere ir hacia arriba?"). Ventajas:
 *   - Cambiar las teclas no afecta al motor (solo a CONTROLS en config.ts).
 *   - Mañana se puede añadir un mando o controles táctiles creando otra
 *     implementación de esta interfaz, sin tocar Player ni GameSession.
 *   - En los tests se usa una implementación falsa que decide qué está "pulsado".
 */
import type { GameAction } from '../config';

export interface InputState {
  isDown(action: GameAction): boolean;
}
