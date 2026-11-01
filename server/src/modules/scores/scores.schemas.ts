/**
 * Esquemas de validación de las puntuaciones.
 */
import { z } from 'zod';
import { isValidLevel, MAX_LEVEL, MAX_POINTS_PER_GAME, POINTS_PER_KILL } from '@pijobeer/shared';

const levelSchema = z
  .number()
  .int()
  .refine(isValidLevel, { message: `Level must be between 1 and ${MAX_LEVEL}` });

/** POST /api/scores/start: el nivel que se va a jugar. */
export const startGameSchema = z.object({ level: levelSchema });

/** POST /api/scores: el ticket de la partida y sus puntos (el nivel va dentro del ticket). */
export const submitScoreSchema = z.object({
  ticket: z.string().min(1).max(1000),
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
});

export type StartGameInput = z.infer<typeof startGameSchema>;
export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;
