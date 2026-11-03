/**
 * Reglas de puntuación compartidas.
 *
 * El juego original no calculaba puntos, y por eso el ranking siempre estaba
 * vacío. Ahora cada enemigo eliminado suma sus puntos (ENEMY_POINTS).
 *
 * El servidor no se fía de los puntos que manda el navegador: los compara con
 * maxPointsFor (lo máximo que da tiempo a conseguir) y con MAX_POINTS_PER_GAME
 * (un tope de cordura). No es un antitrampas completo (eso exigiría repetir la
 * partida entera en el servidor), pero obliga al tramposo a esperar lo mismo
 * que tardaría jugando y le impide pasar del máximo posible.
 */
import { DIFFICULTIES } from './difficulty';
import { getLevel, type BossId, type EnemyTypeId } from './levels';

/**
 * Puntos que da cada botella eliminada, y la unidad de toda la puntuación:
 * el servidor rechaza cualquier cifra que no sea múltiplo suyo.
 */
export const POINTS_PER_KILL = 10;

/**
 * Puntos de cada tipo de enemigo. Las botellas dan lo normal; los barriles
 * pequeños, que aguantan varios impactos, más: 50 los de madera (3 impactos)
 * y 80 el de hierro (5). Múltiplos de POINTS_PER_KILL.
 */
export const ENEMY_POINTS = {
  normal: POINTS_PER_KILL,
  fast: POINTS_PER_KILL,
  heavy: POINTS_PER_KILL,
  barrel: 50,
  woodBarrel: 50,
  ironBarrel: 80,
} as const satisfies Record<EnemyTypeId, number>;

/**
 * Puntos extra por derrotar a cada jefe final (en el nivel 4 hay dos pijos:
 * cuentan los dos). Múltiplos de POINTS_PER_KILL.
 */
export const BOSS_POINTS = {
  wood: 300,
  iron: 500,
  pijo: 400,
  primo: 1000,
} as const satisfies Record<BossId, number>;

/** Máximo de puntos que el servidor acepta para una sola partida. */
export const MAX_POINTS_PER_GAME = 1_000_000;

/**
 * Pasos de simulación por segundo: el motor del juego avanza exactamente 60
 * pasos por segundo en cualquier monitor (ver client/src/game/GameLoop.ts).
 * Está aquí porque el servidor también lo necesita, para maxPointsFor.
 */
export const SIMULATION_STEPS_PER_SECOND = 60;

/**
 * Lo que lanza cada jefe que se pueda eliminar para sumar puntos (null = no
 * lanza nada así: su espuma no da puntos):
 *   gap     lo más seguido que lanza, en pasos entre una cosa y la siguiente
 *   points  lo que vale lo más caro que puede lanzar
 * Con furia, el pijo lanza una botella cada 108 × 0,5 = 54 pasos y el primo un
 * barril (como mucho de hierro) cada 150 × 0,7 = 105 (BOSS en
 * client/src/game/config.ts). Si un jefe pasara a lanzar más deprisa, el test
 * del cliente que comprueba maxPointsFor fallaría y avisaría de que hay que
 * cambiarlo aquí.
 */
const BOSS_THROWS = {
  wood: null,
  iron: null,
  pijo: { gap: 54, points: POINTS_PER_KILL },
  primo: { gap: 105, points: ENEMY_POINTS.ironBarrel },
} as const satisfies Record<BossId, { gap: number; points: number } | null>;

/**
 * ANTITRAMPAS: el máximo de puntos que es posible conseguir en `seconds`
 * segundos de partida en un nivel, jugando perfecto.
 *
 * No hay un máximo fijo por nivel: mientras el jugador no avanza siguen
 * saliendo botellas, y contra los pijos no paran de llegar barriles. Pero los
 * enemigos salen a un ritmo fijo, así que en un tiempo dado solo pueden
 * aparecer unos cuantos, y no se puede ganar más puntos que los que valen los
 * que han salido. Es un tope por arriba: cuenta como si todo valiera lo del
 * enemigo más caro del nivel y se jugara en la dificultad que más da.
 *
 * El servidor mide el tiempo él mismo (ver el ticket de partida en
 * server/src/modules/scores), así que el jugador no puede inflarlo.
 */
export function maxPointsFor(levelId: number, seconds: number): number {
  const level = getLevel(levelId);
  const steps = Math.max(0, seconds) * SIMULATION_STEPS_PER_SECOND;
  const difficulties = Object.values(DIFFICULTIES);
  const spawnRate = Math.max(...difficulties.map((difficulty) => difficulty.spawnRate));
  const pointsScale = Math.max(...difficulties.map((difficulty) => difficulty.points));

  /** Veces que ocurre en `steps` algo que pasa cada `interval` pasos (+1: por si pasa al empezar). */
  const times = (interval: number) => Math.floor(steps / interval) + 1;
  // El juego redondea el intervalo de aparición (rules.ts): medio paso menos cubre ese redondeo
  const spawnEvery = (baseInterval: number) => baseInterval / spawnRate - 0.5;

  const mix = Object.keys(level.enemyMix) as EnemyTypeId[];
  const bestEnemy = Math.max(...mix.map((type) => ENEMY_POINTS[type]));
  let points = times(spawnEvery(level.spawnInterval)) * bestEnemy;

  if (level.bossFightEnemy) {
    const { type, spawnInterval } = level.bossFightEnemy;
    points += times(spawnEvery(spawnInterval)) * ENEMY_POINTS[type];
  }
  for (const boss of level.bosses) {
    points += BOSS_POINTS[boss];
    const throws = BOSS_THROWS[boss];
    if (throws !== null) points += times(throws.gap) * throws.points;
  }
  return points * pointsScale;
}
