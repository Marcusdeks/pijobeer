/**
 * Configuración del servidor a partir de las variables de entorno.
 *
 * Por qué validar las variables al arrancar:
 *   process.env solo contiene textos, y cualquiera puede faltar o venir mal
 *   escrito. Sin esta comprobación, el servidor arrancaría "bien" y fallaría
 *   horas después, en la primera petición que necesitara esa variable.
 *   Así, si falta algo, el proceso se detiene en el segundo 0 diciendo qué.
 *
 * El resto del código importa `env` desde aquí y NUNCA lee process.env
 * directamente: de este modo todas las variables están documentadas y
 * tipadas en un solo sitio (env.PORT es un number, no un string).
 */
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // z.coerce convierte el texto "3000" en el número 3000
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  // 32 caracteres como mínimo: una clave corta se puede adivinar por fuerza bruta
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  // Duración de la sesión en días. Una única variable para el token Y la
  // cookie: si fueran por separado, acabarían desincronizándose.
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  // Entre 4 y 15: menos es inseguro y más hace cada login exageradamente lento
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Aquí todavía no hay logger (depende de esta config), así que console.error.
  console.error('❌ Variables de entorno no válidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/** Atajos de lectura habitual. */
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
