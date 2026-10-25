/**
 * Middleware de validación del cuerpo de la petición.
 *
 * Uso en una ruta:
 *     router.post('/login', validateBody(loginSchema), controller.login);
 *
 * Qué hace:
 *   1. Comprueba req.body contra el esquema Zod.
 *   2. Si no cumple -> responde 400 con el detalle de cada campo que falla
 *      (el controlador ni siquiera llega a ejecutarse).
 *   3. Si cumple -> sustituye req.body por la versión YA LIMPIA (tipos
 *      convertidos, espacios recortados, campos desconocidos eliminados).
 *
 * Así cada controlador recibe datos de los que se puede fiar, en vez de
 * repetir los "?? ''" y los if de validación en cada endpoint como en PHP.
 */
import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../../errors/app-error';

export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    // "?? {}": si el cliente no manda cuerpo, validamos un objeto vacío
    // (así el error dice qué campos faltan, en vez de "esperaba un objeto").
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(body)',
        message: issue.message,
      }));
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid request body', details);
    }

    req.body = result.data;
    next();
  };
}
