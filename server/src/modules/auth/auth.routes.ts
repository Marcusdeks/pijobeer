/**
 * RUTAS DE AUTENTICACIÓN  ->  montadas en /api/auth (ver app.ts)
 *
 *   POST /register       Crear cuenta
 *   POST /login          Iniciar sesión (pone la cookie)
 *   POST /logout         Cerrar sesión (borra la cookie)
 *   GET  /me             ¿Quién soy? (null si no hay sesión)
 *   POST /verify-email   Confirmar el email con el token del enlace
 *
 * Cada línea se lee de izquierda a derecha como una cadena de montaje:
 *   ruta -> limitador -> validación -> controlador
 * Si un eslabón corta (demasiadas peticiones, datos inválidos), los
 * siguientes no se ejecutan.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../errors/app-error';
import { validateBody } from '../../http/middlewares/validate';
import type { AuthController } from './auth.controller';
import { loginSchema, registerSchema, verifyEmailSchema } from './auth.schemas';

export interface AuthRouterOptions {
  /** Desactivable en los tests, que hacen muchas peticiones seguidas. */
  rateLimitEnabled: boolean;
}

export function createAuthRouter(controller: AuthController, options: AuthRouterOptions): Router {
  const router = Router();

  /* Limitador de intentos: como mucho 20 peticiones cada 15 minutos por IP.
     Frena a quien intente adivinar contraseñas probando miles seguidas
     (ataque de "fuerza bruta") o crear cuentas en masa con un script. */
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8', // informa al cliente con la cabecera RateLimit
    legacyHeaders: false,
    skip: () => !options.rateLimitEnabled,
    // Pasamos el error a next() para que lo formatee el errorHandler como todos los demás
    handler: (_req, _res, next) => {
      next(new AppError(429, 'TOO_MANY_REQUESTS', 'Too many attempts, try again later'));
    },
  });

  router.post('/register', authLimiter, validateBody(registerSchema), controller.register);
  router.post('/login', authLimiter, validateBody(loginSchema), controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', controller.me);
  router.post(
    '/verify-email',
    authLimiter,
    validateBody(verifyEmailSchema),
    controller.verifyEmail,
  );

  return router;
}
