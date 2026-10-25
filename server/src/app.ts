/**
 * CONSTRUCCIÓN DE LA APLICACIÓN EXPRESS.
 *
 * createApp() recibe sus dependencias (repositorios, hasher, tokens...) en
 * vez de crearlas. Esto permite:
 *   - En producción (index.ts): pasarle las reales, conectadas a PostgreSQL.
 *   - En los tests: pasarle versiones en memoria y hacer peticiones HTTP
 *     de verdad (con supertest) sin base de datos ni puertos abiertos.
 *
 * El orden de los middlewares IMPORTA: cada petición los atraviesa de arriba
 * abajo, como una cadena de montaje.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { authenticate } from './http/middlewares/authenticate';
import { errorHandler, notFoundHandler } from './http/middlewares/error-handler';
import { logger } from './lib/logger';
import type { Mailer } from './lib/mailer';
import { createAdminRouter } from './modules/admin/admin.routes';
import { AdminService } from './modules/admin/admin.service';
import { AuthController } from './modules/auth/auth.controller';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import type { PasswordHasher } from './modules/auth/password-hasher';
import type { TokenService } from './modules/auth/token.service';
import type { ScoreRepository } from './modules/scores/score.repository';
import { ScoresController } from './modules/scores/scores.controller';
import { createScoresRouter } from './modules/scores/scores.routes';
import { ScoresService } from './modules/scores/scores.service';
import type { UserRepository } from './modules/users/user.repository';
import { UsersController } from './modules/users/users.controller';
import { createUsersRouter } from './modules/users/users.routes';
import { UsersService } from './modules/users/users.service';

export interface AppDependencies {
  userRepository: UserRepository;
  scoreRepository: ScoreRepository;
  passwordHasher: PasswordHasher;
  tokenService: TokenService;
  mailer: Mailer;
  /** Comprueba que la BBDD responde (para /api/health). */
  checkDatabase: () => Promise<void>;
  config: {
    clientUrl: string;
    exposeVerificationUrl: boolean;
    rateLimitEnabled: boolean;
    /** true detrás de un proxy (Render, Railway, Nginx...) para leer bien la IP real. */
    trustProxy: boolean;
    /** Carpeta del frontend ya compilado. Si existe, el servidor también lo sirve. */
    clientDistPath?: string;
    /** Registrar cada petición en el log (se apaga en los tests). */
    httpLogging: boolean;
  };
}

export function createApp(deps: AppDependencies): Express {
  const { config } = deps;

  // ---------- Capa de negocio: servicios y controladores ----------
  const authService = new AuthService(
    deps.userRepository,
    deps.passwordHasher,
    deps.tokenService,
    deps.mailer,
    { clientUrl: config.clientUrl, exposeVerificationUrl: config.exposeVerificationUrl },
  );
  const usersService = new UsersService(deps.userRepository, deps.passwordHasher);
  const scoresService = new ScoresService(deps.scoreRepository);
  const adminService = new AdminService(deps.userRepository);

  const authController = new AuthController(authService);
  const usersController = new UsersController(usersService);
  const scoresController = new ScoresController(scoresService);

  // ---------- Express ----------
  const app = express();

  // Sin esto, detrás de un proxy todas las peticiones parecerían venir de la
  // misma IP (la del proxy) y el limitador de intentos bloquearía a todo el mundo a la vez.
  if (config.trustProxy) app.set('trust proxy', 1);

  // No anunciar "X-Powered-By: Express": es información gratis para un atacante
  app.disable('x-powered-by');

  // 1. Cabeceras de seguridad HTTP (anti-clickjacking, anti-sniffing, CSP...)
  app.use(helmet());

  // 2. Log de cada petición: método, URL, código de respuesta y tiempo.
  //    Los "serializers" recortan lo que se escribe: sin ellos se volcarían
  //    todas las cabeceras de cada petición y el log sería ilegible.
  if (config.httpLogging) {
    app.use(
      pinoHttp({
        logger,
        serializers: {
          req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
      }),
    );
  }

  // 3. Lectura del cuerpo JSON (máximo 10 KB: aquí nadie necesita mandar más)
  app.use(express.json({ limit: '10kb' }));

  // 4. Lectura de cookies -> rellena req.cookies
  app.use(cookieParser());

  // 5. Identificar al usuario a partir de la cookie (si la hay)
  app.use('/api', authenticate(deps.tokenService));

  // ---------- Rutas de la API ----------
  app.get('/api/health', async (_req, res) => {
    await deps.checkDatabase();
    res.json({ status: 'ok' });
  });

  app.use(
    '/api/auth',
    createAuthRouter(authController, { rateLimitEnabled: config.rateLimitEnabled }),
  );
  app.use('/api/users', createUsersRouter(usersController));
  app.use('/api/scores', createScoresRouter(scoresController));
  app.use('/api/admin', createAdminRouter(adminService, deps.userRepository));

  // Cualquier otra ruta bajo /api -> 404 en JSON
  app.use('/api', notFoundHandler);

  // ---------- Frontend compilado (solo en producción) ----------
  // Permite desplegar cliente + servidor como UNA sola aplicación.
  if (config.clientDistPath && existsSync(config.clientDistPath)) {
    const indexHtml = path.join(config.clientDistPath, 'index.html');
    app.use(express.static(config.clientDistPath, { index: false, maxAge: '1y', immutable: true }));

    // "SPA fallback": React Router gestiona las URL en el navegador, así que
    // cualquier ruta que no sea un archivo (p. ej. /play) devuelve index.html.
    // HEAD se incluye porque lo usan monitores de disponibilidad y algunos proxies.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.sendFile(indexHtml);
    });
  }

  // ---------- Errores: SIEMPRE el último ----------
  app.use(errorHandler);

  return app;
}
