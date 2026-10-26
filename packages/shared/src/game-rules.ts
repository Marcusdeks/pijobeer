/**
 * Reglas de puntuación compartidas.
 *
 * El juego original no calculaba puntos, y por eso el ranking siempre estaba
 * vacío. Ahora cada enemigo eliminado suma POINTS_PER_KILL.
 *
 * El servidor usa MAX_POINTS_PER_GAME como tope de cordura: impide que
 * alguien mande 999.999.999 puntos a mano desde la consola. No es un
 * antitrampas completo (eso exigiría simular la partida en el servidor),
 * pero corta los abusos más obvios.
 */

/** Puntos que da cada enemigo eliminado. */
export const POINTS_PER_KILL = 10;

/**
 * Puntos extra por derrotar a cada jefe final. Han de ser múltiplos de
 * POINTS_PER_KILL: el servidor rechaza cualquier puntuación que no lo sea.
 */
export const BOSS_POINTS = { blonde: 300, iron: 500 } as const;

/** Máximo de puntos que el servidor acepta para una sola partida. */
export const MAX_POINTS_PER_GAME = 1_000_000;
