/**
 * Esquemas de validación de las puntuaciones.
 */
import { z } from 'zod';
import { isValidLevel, MAX_LEVEL, MAX_POINTS_PER_GAME, POINTS_PER_KILL } from '@pijobeer/shared';

export const submitScoreSchema = z.object({
  points: z
    .number()
    .int()
    .min(0)
    .max(MAX_POINTS_PER_GAME)
    // Cada enemigo da POINTS_PER_KILL: cualquier puntuación que no sea múltiplo
    // es imposible de conseguir jugando, así que viene manipulada.
    .refine((points) => points % POINTS_PER_KILL === 0, {
      message: `Points must be a multiple of ${POINTS_PER_KILL}`,
    }),
  level: z
    .number()
    .int()
    .refine(isValidLevel, { message: `Level must be between 1 and ${MAX_LEVEL}` }),
});

export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;
