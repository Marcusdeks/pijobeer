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
import { FINALE, MIN_SPAWN_INTERVAL, PICKUP, PICKUP_TYPES, PLAYER } from './config';
import type { RandomFn } from './entities/Enemy';
import { exitFor, playfieldFor, type Exit, type Playfield } from './playfield';

export interface GameRules {
  level: LevelDefinition;
  /** Suelo del callejón: nadie puede meterse en las paredes. */
  field: Playfield;
  /**
   * Por dónde se mueven los jefes: el suelo, salvo en las calles con final,
   * donde se quedan a la izquierda del camión aparcado sin tocarlo.
   */
  bossField: Playfield;
  /** Kills para seguir: las del nivel o, si un admin la ha fijado, su cifra (dentro del ayuntamiento, los seguratas). */
  killsToComplete: number;
  /**
   * Cuántas hay que eliminar, para enseñarlo en el marcador; null = no se
   * enseña. Solo se ve en el nivel 1, para aprender cómo va el juego (y si un
   * admin fija la cifra): en los demás, cuánto falta es parte de la sorpresa.
   */
  killGoal: number | null;
  /** Píxeles de callejón que hay que recorrer además (0 = no hace falta). */
  distanceToComplete: number;
  /**
   * Calles con final: hasta dónde avanza el callejón (lo que mide la calle
   * hasta el edificio), y por dónde sale el protagonista al acabar (ver
   * Exit). null = callejón sin
   * final, que se repite sin parar.
   */
  cameraEnd: number | null;
  exit: Exit | null;
  /** Pasos entre disparo y disparo del jugador (con el ritmo del nivel y el de la dificultad). */
  shootCooldown: number;
  /** Pasos entre botella y botella (null = no cae nada, como dentro del ayuntamiento). */
  spawnInterval: number | null;
  /** Enemigos durante el combate con los jefes, con el ritmo ajustado igual que spawnInterval. */
  bossFightEnemy: { type: EnemyTypeId; spawnInterval: number } | null;
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

export function resolveRules(
  levelId: number,
  modifiers: GameModifiers = DEFAULT_GAME_MODIFIERS,
  difficultyId: DifficultyId = DEFAULT_DIFFICULTY,
): GameRules {
  const level = getLevel(levelId);
  const difficulty = DIFFICULTIES[difficultyId];
  // La dificultad y el truco de ritmo afectan igual a todo lo que aparece
  const spawnScale = modifiers.spawnRate * difficulty.spawnRate;
  const intervalFor = (base: number) => Math.max(MIN_SPAWN_INTERVAL, Math.round(base / spawnScale));
  const exit = exitFor(level);
  const field = playfieldFor(level);

  return {
    level,
    field,
    bossField: exit ? { ...field, right: FINALE.truck.x - FINALE.truckGap } : field,
    killsToComplete: modifiers.killsToComplete ?? level.killsToComplete,
    killGoal: modifiers.killsToComplete ?? (level.id === 1 ? level.killsToComplete : null),
    // Si un admin fija las botellas, ese es el objetivo entero: así puede probar el jefe sin esperar
    distanceToComplete: modifiers.killsToComplete === null ? level.distanceToComplete : 0,
    // La calle mide lo mismo con o sin trucos: es el dibujo
    cameraEnd: exit && level.distanceToComplete,
    exit,
    shootCooldown: Math.round(PLAYER.shootCooldown / (difficulty.fireRate * level.playerFireRate)),
    spawnInterval: level.spawnInterval === null ? null : intervalFor(level.spawnInterval),
    bossFightEnemy: level.bossFightEnemy && {
      type: level.bossFightEnemy.type,
      spawnInterval: intervalFor(level.bossFightEnemy.spawnInterval),
    },
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
