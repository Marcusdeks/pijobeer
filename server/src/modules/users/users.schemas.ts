/**
 * Esquemas de validación del perfil y del progreso.
 */
import { z } from 'zod';
import { isValidLevel, MAX_LEVEL, PASSWORD_MAX_LENGTH } from '@pijobeer/shared';
import { newPasswordSchema, usernameSchema } from '../auth/auth.schemas';

/**
 * Trata el texto vacío como "no enviado". Un formulario manda "" en las
 * casillas que el jugador deja en blanco, y para nosotros eso significa
 * "no quiero cambiar esto", no "quiero que mi contraseña sea vacía".
 */
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const updateProfileSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  username: z.preprocess(emptyToUndefined, usernameSchema.optional()),
  newPassword: z.preprocess(emptyToUndefined, newPasswordSchema.optional()),
  newPasswordConfirm: z.preprocess(emptyToUndefined, z.string().optional()),
});

export const updateProgressSchema = z.object({
  /* El navegador puede mandar cualquier cosa (basta con abrir la consola),
     así que solo se aceptan niveles que existen de verdad. Antes este tope
     estaba duplicado en comun.php; ahora sale de @pijobeer/shared. */
  maxLevel: z
    .number()
    .int()
    .refine(isValidLevel, { message: `Level must be between 1 and ${MAX_LEVEL}` })
    .optional(),
  introSeen: z.literal(true).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
