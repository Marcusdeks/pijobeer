/**
 * RUTAS DE "JUEGO ADMIN"  ->  montadas en /api/admin (solo administradores)
 *
 *   GET  /modifiers   Trucos actuales
 *   PUT  /modifiers   Cambiar trucos a mano (solo los campos enviados)
 *   POST /agent       Hablar con el agente (la conversación completa)
 *
 * Controlador y rutas van juntos porque son tres líneas cada uno.
 */
import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import { getAuthUserId, requireAuth } from '../../http/middlewares/authenticate';
import { validateBody } from '../../http/middlewares/validate';
import type { UserRepository } from '../users/user.repository';
import type { AdminService } from './admin.service';
import { modifiersUpdateSchema, type ModifiersUpdate } from './modifiers';

/** Conversación con el agente: límites para que nadie mande textos enormes (cuestan dinero). */
const agentRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(40)
    .refine((messages) => messages.at(-1)?.role === 'user', {
      message: 'The last message must be from the user',
    }),
});

/**
 * Deja pasar solo a administradores. Se comprueba en la BBDD en cada
 * petición (no basta con el token): si se le quitan los permisos a alguien,
 * deja de tener acceso al momento.
 */
export function requireAdmin(users: UserRepository): RequestHandler {
  return async (req, _res, next) => {
    const user = await users.findById(getAuthUserId(req));
    if (!user?.isAdmin) throw AppError.forbidden('FORBIDDEN', 'Admin only');
    next();
  };
}

export function createAdminRouter(
  admin: AdminService,
  users: UserRepository,
  options: { rateLimitEnabled: boolean },
): Router {
  const router = Router();
  router.use(requireAuth, requireAdmin(users));

  router.get('/modifiers', async (req, res) => {
    res.json({ modifiers: await admin.getModifiers(getAuthUserId(req)) });
  });

  router.put('/modifiers', validateBody(modifiersUpdateSchema), async (req, res) => {
    const modifiers = await admin.updateModifiers(getAuthUserId(req), req.body as ModifiersUpdate);
    res.json({ modifiers });
  });

  // Cada mensaje al agente es una llamada de pago a la API de Claude: se limita el ritmo
  const agentLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !options.rateLimitEnabled,
    handler: (_req, _res, next) => {
      next(new AppError(429, 'TOO_MANY_REQUESTS', 'Too many agent requests'));
    },
  });

  router.post('/agent', agentLimiter, validateBody(agentRequestSchema), async (req, res) => {
    const { messages } = req.body as z.infer<typeof agentRequestSchema>;
    res.json(await admin.chat(getAuthUserId(req), messages));
  });

  return router;
}
