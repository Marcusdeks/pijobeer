/**
 * Esquemas de validación de las peticiones de autenticación (Zod).
 *
 * Un esquema describe cómo DEBE ser lo que llega. El middleware validateBody
 * lo aplica antes del controlador, así que, si la petición llega al
 * controlador, ya cumple todo esto.
 *
 * Los límites (longitudes, patrón del nombre) vienen de @pijobeer/shared:
 * son los mismos que usa el formulario del cliente.
 *
 * Los mensajes van en inglés porque son para desarrolladores (aparecen en
 * "details" de la respuesta 400). Lo que lee el jugador lo traduce el cliente.
 */
import { z } from 'zod';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@pijobeer/shared';

/** Reglas del nombre de usuario. Exportado porque el perfil usa exactamente las mismas. */
export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(USERNAME_PATTERN, 'Only letters, numbers and "_"');

/** Reglas de una contraseña NUEVA (al registrarse o al cambiarla en el perfil). */
export const newPasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const registerSchema = z
  .object({
    username: usernameSchema,
    // Guardamos el email en minúsculas: "Pepe@Mail.com" y "pepe@mail.com" son la misma cuenta
    email: z.string().trim().toLowerCase().email().max(EMAIL_MAX_LENGTH),
    password: newPasswordSchema,
    passwordConfirm: z.string(),
  })
  // .refine añade una regla que mira VARIOS campos a la vez
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  // En el login NO se exige longitud mínima: si el jugador escribe una
  // contraseña corta simplemente será incorrecta, no un "error de formato".
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const verifyEmailSchema = z.object({
  // Los tokens son 64 caracteres hexadecimales (ver AuthService.generateVerificationToken)
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Malformed token'),
});

// z.infer saca el tipo TypeScript del esquema: una sola definición sirve para validar Y tipar
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
