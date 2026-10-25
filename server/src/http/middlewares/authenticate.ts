/**
 * Middlewares de autenticación.
 *
 *   authenticate(tokens) -> se aplica a TODAS las rutas de la API. Si llega
 *       una cookie de sesión válida, pone el id en req.userId. Si no llega o
 *       no es válida, no hace nada (hay rutas públicas, como el ranking).
 *
 *   requireAuth -> se pone en las rutas que NO tienen sentido sin sesión
 *       (guardar una puntuación, cambiar el perfil...). Equivale al
 *       exigirSesion() del PHP: si no hay usuario, corta con un 401.
 *
 * El id del usuario sale SIEMPRE del token firmado, nunca de lo que mande el
 * navegador en el cuerpo de la petición: así nadie puede actuar en nombre de otro.
 */
import type { RequestHandler } from 'express';
import { AppError } from '../../errors/app-error';
import { SESSION_COOKIE_NAME } from '../../modules/auth/session-cookie';
import type { TokenService } from '../../modules/auth/token.service';

export function authenticate(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    // req.cookies lo rellena el middleware cookie-parser (ver app.ts)
    const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];

    if (typeof token === 'string') {
      const userId = tokens.verify(token);
      if (userId !== null) req.userId = userId;
    }

    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (req.userId === undefined) {
    throw AppError.unauthorized();
  }
  next();
};

/**
 * Devuelve el id del usuario de la petición. Pensado para los controladores
 * de rutas protegidas con requireAuth, donde se sabe que existe; así no
 * tienen que comprobar "undefined" cada vez.
 */
export function getAuthUserId(req: Express.Request): number {
  if (req.userId === undefined) {
    // Si llega aquí es un fallo de programación: falta requireAuth en la ruta.
    throw AppError.unauthorized();
  }
  return req.userId;
}
