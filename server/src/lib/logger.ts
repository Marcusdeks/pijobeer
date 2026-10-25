/**
 * Logger de la aplicación (pino).
 *
 * Por qué no console.log:
 *   - pino escribe JSON estructurado ({"level":30,"msg":"...","userId":4}),
 *     que los servicios de logs en producción saben filtrar y buscar.
 *   - Tiene niveles (debug, info, warn, error) que se activan por entorno
 *     con LOG_LEVEL, sin tocar el código.
 *   - Es muy rápido: no frena el servidor aunque se escriba mucho.
 *
 * En desarrollo usamos "pino-pretty" para verlo con colores y legible.
 */
import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  // "redact" sustituye estos campos por "[Redacted]" si alguna vez se
  // intentan escribir en el log: las contraseñas y cookies nunca deben acabar ahí.
  redact: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.passwordHash'],
  // Formato bonito solo en desarrollo; en producción y tests, JSON puro (más rápido)
  ...(env.NODE_ENV !== 'development'
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});
