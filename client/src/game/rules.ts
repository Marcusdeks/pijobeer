/**
 * REGLAS DE UNA PARTIDA: el nivel + los trucos de administrador, ya combinados.
 *
 * GameSession no lee el nivel ni los trucos por separado: recibe estas
 * reglas ya calculadas. Así hay UN solo sitio donde se decide, por ejemplo,
 * cuántas botellas hay que eliminar ("las del nivel, salvo que un admin
 * haya puesto otra cifra").
 */
import {
  DEFAULT_GAME_MODIFIERS,
  getLevel,
  type EnemyTypeId,
  type GameModifiers,
  type LevelDefinition,
} from '@pijobeer/shared';
import type { RandomFn } from './entities/Enemy';
import { playfieldFor, type Playfield } from './playfield';

export interface GameRules {
  level: LevelDefinition;
  /** Suelo del callejón: nadie puede meterse en las paredes. */
  field: Playfield;
  killsToComplete: number;
  spawnInterval: number;
  /** Multiplicador final de la velocidad de las botellas (nivel × truco). */
  enemySpeed: number;
  bossHealth: number;
  invincible: boolean;
  /** Elige al azar el tipo de la siguiente botella, según la mezcla del nivel. */
  pickEnemyType: (random: RandomFn) => EnemyTypeId;
}

/** Nunca sale más de una botella cada este número de pasos, aunque un truco lo pida. */
const MIN_SPAWN_INTERVAL = 10;

export function resolveRules(
  levelId: number,
  modifiers: GameModifiers = DEFAULT_GAME_MODIFIERS,
): GameRules {
  const level = getLevel(levelId);

  return {
    level,
    field: playfieldFor(level),
    killsToComplete: modifiers.killsToComplete ?? level.killsToComplete,
    spawnInterval: Math.max(
      MIN_SPAWN_INTERVAL,
      Math.round(level.spawnInterval / modifiers.spawnRate),
    ),
    enemySpeed: level.enemySpeed * modifiers.enemySpeed,
    bossHealth: modifiers.bossHealth,
    invincible: modifiers.invincible,
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
