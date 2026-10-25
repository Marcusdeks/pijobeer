/**
 * Validación de los trucos de "juego admin".
 *
 * Los mismos esquemas sirven para los dos caminos por los que se cambian:
 * el panel manual (PUT /api/admin/modifiers) y el agente (sus herramientas).
 * Así, ni a mano ni pidiéndoselo al agente se puede poner un valor absurdo.
 */
import {
  DEFAULT_GAME_MODIFIERS,
  GAME_MODIFIER_LIMITS as LIMITS,
  type GameModifiers,
} from '@pijobeer/shared';
import { z } from 'zod';

/** Cambios parciales: solo los campos que vengan se modifican. Campos desconocidos -> error. */
export const modifiersUpdateSchema = z
  .object({
    invincible: z.boolean(),
    killsToComplete: z
      .number()
      .int()
      .min(LIMITS.killsToComplete.min)
      .max(LIMITS.killsToComplete.max)
      .nullable(),
    enemySpeed: z.number().min(LIMITS.enemySpeed.min).max(LIMITS.enemySpeed.max),
    spawnRate: z.number().min(LIMITS.spawnRate.min).max(LIMITS.spawnRate.max),
    bossHealth: z.number().min(LIMITS.bossHealth.min).max(LIMITS.bossHealth.max),
  })
  .partial()
  .strict();

export type ModifiersUpdate = z.infer<typeof modifiersUpdateSchema>;

/**
 * Lee los trucos guardados en la BBDD. Lo que falte o no sea válido (p. ej.
 * datos de una versión anterior) se sustituye por el valor normal, así que
 * siempre devuelve un objeto completo y correcto.
 */
export function readModifiers(stored: unknown): GameModifiers {
  if (typeof stored !== 'object' || stored === null) return { ...DEFAULT_GAME_MODIFIERS };

  const result: GameModifiers = { ...DEFAULT_GAME_MODIFIERS };
  for (const key of Object.keys(DEFAULT_GAME_MODIFIERS) as Array<keyof GameModifiers>) {
    const field = modifiersUpdateSchema.shape[key].safeParse(
      (stored as Record<string, unknown>)[key],
    );
    if (field.success && field.data !== undefined) Object.assign(result, { [key]: field.data });
  }
  return result;
}
