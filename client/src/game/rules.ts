/**
 * REGLAS DE UNA PARTIDA: el nivel + la dificultad + los trucos de
 * administrador, ya combinados.
 *
 * GameSession no lee el nivel, la dificultad ni los trucos por separado:
 * recibe estas reglas ya calculadas. Así hay UN solo sitio donde se decide,
 * por ejemplo, cuántas botellas hay que eliminar ("las del nivel, salvo que
 * un admin haya puesto otra cifra"). Dificultad y trucos se MULTIPLICAN:
 * en difícil con el truco de velocidad ×2, las botellas van a 1,15 × 2.
 */
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_GAME_MODIFIERS,
  DIFFICULTIES,
  getLevel,
  type DifficultyId,
  type EnemyTypeId,
  type GameModifiers,
  type LevelDefinition,
} from '@pijobeer/shared';
import { PICKUP, PICKUP_TYPES, PLAYER } from './config';
import type { RandomFn } from './entities/Enemy';
import { playfieldFor, type Playfield } from './playfield';

export interface GameRules {
  level: LevelDefinition;
  /** Suelo del callejón: nadie puede meterse en las paredes. */
  field: Playfield;
  killsToComplete: number;
  /** Píxeles de callejón que hay que recorrer además (0 = no hace falta). */
  distanceToComplete: number;
  /** Pasos entre disparo y disparo del jugador. */
  shootCooldown: number;
  spawnInterval: number;
  /** Multiplicador final de la velocidad de las botellas (nivel × truco). */
  enemySpeed: number;
  bossHealth: number;
  invincible: boolean;
  /** Multiplicador de la vida que pierde el jugador en cada golpe. */
  damageTaken: number;
  /** Pasos entre lata y lata. */
  pickupInterval: number;
  /** Vida que recupera la lata verde. */
  healAmount: number;
  /** Multiplicador de los puntos de la partida. */
  pointsScale: number;
  /** Elige al azar el tipo de la siguiente botella, según la mezcla del nivel. */
  pickEnemyType: (random: RandomFn) => EnemyTypeId;
}

/** Nunca sale más de una botella cada este número de pasos, aunque un truco lo pida. */
const MIN_SPAWN_INTERVAL = 10;

export function resolveRules(
  levelId: number,
  modifiers: GameModifiers = DEFAULT_GAME_MODIFIERS,
  difficultyId: DifficultyId = DEFAULT_DIFFICULTY,
): GameRules {
  const level = getLevel(levelId);
  const difficulty = DIFFICULTIES[difficultyId];

  return {
    level,
    field: playfieldFor(level),
    killsToComplete: modifiers.killsToComplete ?? level.killsToComplete,
    // Si un admin fija las botellas, ese es el objetivo entero: así puede probar el jefe sin esperar
    distanceToComplete: modifiers.killsToComplete === null ? level.distanceToComplete : 0,
    shootCooldown: Math.round(PLAYER.shootCooldown / difficulty.fireRate),
    spawnInterval: Math.max(
      MIN_SPAWN_INTERVAL,
      Math.round(level.spawnInterval / (modifiers.spawnRate * difficulty.spawnRate)),
    ),
    enemySpeed: level.enemySpeed * modifiers.enemySpeed * difficulty.enemySpeed,
    bossHealth: modifiers.bossHealth * difficulty.bossHealth,
    invincible: modifiers.invincible,
    damageTaken: difficulty.damageTaken,
    pickupInterval: Math.round(PICKUP.spawnInterval / difficulty.pickupRate),
    healAmount: Math.round(PICKUP_TYPES.health.heal * difficulty.pickupHeal),
    pointsScale: difficulty.points,
    pickEnemyType: weightedPicker(level.enemyMix),
  };
}

/**
 * Sorteo con pesos: con { normal: 5, fast: 3, heavy: 2 }, de cada 10 botellas
 * salen de media 5 normales, 3 rápidas y 2 pesadas.
 */
function weightedPicker(mix: LevelDefinition['enemyMix']): GameRules['pickEnemyType'] {
  const entries = Object.entries(mix) as Array<[EnemyTypeId, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);

  return (random) => {
    let roll = random() * total;
    for (const [type, weight] of entries) {
      roll -= weight;
      if (roll < 0) return type;
    }
    return entries[entries.length - 1]![0];
  };
}
