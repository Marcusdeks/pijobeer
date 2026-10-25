/**
 * COMPOSITION ROOT: el único sitio donde se crean las dependencias REALES.
 *
 * Aquí se decide "qué pieza concreta se usa para cada cosa":
 *   - Repositorios -> Prisma (PostgreSQL)
 *   - Contraseñas  -> bcrypt
 *   - Sesiones     -> JWT
 *   - Correo       -> consola (hasta que se conecte un proveedor real)
 *
 * Si mañana se cambia el proveedor de correo o la base de datos, se toca
 * este archivo y nada más; los servicios no se enteran.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppDependencies } from './app';
import { env, isProduction } from './config/env';
import { logger } from './lib/logger';
import { ConsoleMailer } from './lib/mailer';
import { prisma } from './lib/prisma';
import { ClaudeGameAgent } from './modules/admin/game-agent';
import { BcryptPasswordHasher } from './modules/auth/password-hasher';
import { JwtTokenService } from './modules/auth/token.service';
import { PrismaScoreRepository } from './modules/scores/score.repository';
import { PrismaUserRepository } from './modules/users/user.repository';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export function buildDependencies(): AppDependencies {
  return {
    userRepository: new PrismaUserRepository(prisma),
    scoreRepository: new PrismaScoreRepository(prisma),
    passwordHasher: new BcryptPasswordHasher(env.BCRYPT_ROUNDS),
    tokenService: new JwtTokenService(env.JWT_SECRET, env.SESSION_TTL_DAYS * 24 * 60 * 60),
    mailer: new ConsoleMailer(logger),
    // El agente es opcional: sin clave, "juego admin" funciona solo con el panel manual
    gameAgent: env.ANTHROPIC_API_KEY ? new ClaudeGameAgent(env.ANTHROPIC_API_KEY) : null,
    checkDatabase: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    config: {
      clientUrl: env.CLIENT_URL,
      // Mientras no haya correo real, el enlace se enseña en pantalla SOLO en desarrollo
      exposeVerificationUrl: !isProduction,
      rateLimitEnabled: true,
      trustProxy: isProduction,
      // dist/index.js -> ../../client/dist (cliente compilado con "npm run build")
      clientDistPath: path.resolve(currentDir, '../../client/dist'),
      httpLogging: true,
    },
  };
}
