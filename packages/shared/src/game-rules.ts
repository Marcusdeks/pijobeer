/**
 * Reglas de puntuación compartidas.
 *
 * El juego original no calculaba puntos, y por eso el ranking siempre estaba
 * vacío. Ahora cada enemigo eliminado suma sus puntos (ENEMY_POINTS).
 *
 * El servidor usa MAX_POINTS_PER_GAME como tope de cordura: impide que
 * alguien mande 999.999.999 puntos a mano desde la consola. No es un
 * antitrampas completo (eso exigiría simular la partida en el servidor),
 * pero corta los abusos más obvios.
 */
import type { BossId, EnemyTypeId } from './levels';

/**
 * Puntos que da cada botella eliminada, y la unidad de toda la puntuación:
 * el servidor rechaza cualquier cifra que no sea múltiplo suyo.
 */
export const POINTS_PER_KILL = 10;

/**
 * Puntos de cada tipo de enemigo. Las botellas dan lo normal; el barril
 * pequeño, que aguanta 3 impactos, cinco veces más. Múltiplos de POINTS_PER_KILL.
 */
export const ENEMY_POINTS = {
  normal: POINTS_PER_KILL,
  fast: POINTS_PER_KILL,
  heavy: POINTS_PER_KILL,
  barrel: 50,
} as const satisfies Record<EnemyTypeId, number>;

/**
 * Puntos extra por derrotar a cada jefe final (en el nivel 4 hay dos pijos:
 * cuentan los dos). Múltiplos de POINTS_PER_KILL.
 */
export const BOSS_POINTS = { wood: 300, iron: 500, pijo: 400 } as const satisfies Record<
  BossId,
  number
>;

/** Máximo de puntos que el servidor acepta para una sola partida. */
export const MAX_POINTS_PER_GAME = 1_000_000;
