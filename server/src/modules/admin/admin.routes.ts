/**
 * RUTAS DE "JUEGO ADMIN"  ->  montadas en /api/admin (solo administradores)
 *
 *   GET  /modifiers   Trucos actuales
 *   PUT  /modifiers   Cambiar trucos (solo los campos enviados)
 *
 * Controlador y rutas van juntos porque son dos líneas cada uno.
 */
import { Router, type RequestHandler } from 'express';
import { AppError } from '../../errors/app-error';
import { getAuthUserId, requireAuth } from '../../http/middlewares/authenticate';
import { validateBody } from '../../http/middlewares/validate';
import type { UserRepository } from '../users/user.repository';
import type { AdminService } from './admin.service';
import { modifiersUpdateSchema, type ModifiersUpdate } from './modifiers';

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

export function createAdminRouter(admin: AdminService, users: UserRepository): Router {
  const router = Router();
  router.use(requireAuth, requireAdmin(users));

  router.get('/modifiers', async (req, res) => {
    res.json({ modifiers: await admin.getModifiers(getAuthUserId(req)) });
  });

  router.put('/modifiers', validateBody(modifiersUpdateSchema), async (req, res) => {
    const modifiers = await admin.updateModifiers(getAuthUserId(req), req.body as ModifiersUpdate);
    res.json({ modifiers });
  });

  return router;
}
