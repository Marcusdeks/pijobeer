/**
 * TRUCOS DE ADMINISTRADOR ("juego admin").
 *
 * Un administrador puede alterar SUS propias partidas para probar el juego:
 * hacerse inmortal, cambiar cuántas botellas hay que eliminar, etc. Los
 * cambia desde la sección "Juego admin", a mano o pidiéndoselo al agente.
 *
 * Solo afectan a las partidas de ese administrador, y una partida con algún
 * truco activo NO se guarda en el ranking (sería hacer trampa).
 *
 * Este archivo es el contrato: los límites de cada valor se comprueban en el
 * servidor con GAME_MODIFIER_LIMITS, y el cliente los aplica al jugar.
 */

export interface GameModifiers {
  /** El jugador no pierde vida. */
  invincible: boolean;
  /** Si no es null, sustituye a las botellas a eliminar de TODOS los niveles. */
  killsToComplete: number | null;
  /** Multiplicador de la velocidad de las botellas (1 = normal). */
  enemySpeed: number;
  /** Multiplicador de la cantidad de botellas que aparecen (2 = el doble). */
  spawnRate: number;
  /** Multiplicador de la vida de los jefes (0,5 = la mitad). */
  bossHealth: number;
}

export const DEFAULT_GAME_MODIFIERS: GameModifiers = {
  invincible: false,
  killsToComplete: null,
  enemySpeed: 1,
  spawnRate: 1,
  bossHealth: 1,
};

/** Valores permitidos de cada truco numérico (el servidor rechaza lo que se salga). */
export const GAME_MODIFIER_LIMITS = {
  killsToComplete: { min: 0, max: 500 },
  enemySpeed: { min: 0.25, max: 3 },
  spawnRate: { min: 0.25, max: 4 },
  bossHealth: { min: 0.1, max: 5 },
} as const;

/** true si hay algún truco distinto del valor normal (la partida no contará para el ranking). */
export function hasActiveModifiers(modifiers: GameModifiers): boolean {
  return (Object.keys(DEFAULT_GAME_MODIFIERS) as Array<keyof GameModifiers>).some(
    (key) => modifiers[key] !== DEFAULT_GAME_MODIFIERS[key],
  );
}
