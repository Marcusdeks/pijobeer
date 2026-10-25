/**
 * RUTAS DE USUARIO  ->  montadas en /api/users (ver app.ts)
 *
 *   PATCH /me            Cambiar nombre y/o contraseña
 *   PATCH /me/progress   Guardar nivel desbloqueado / intro vista
 *
 * "me" en vez de "/users/:id": el usuario siempre es el de la sesión.
 * Con un :id en la URL habría que comprobar en cada ruta que coincide con
 * la sesión, y olvidarlo una sola vez permitiría modificar cuentas ajenas.
 */
import { Router } from 'express';
import { requireAuth } from '../../http/middlewares/authenticate';
import { validateBody } from '../../http/middlewares/validate';
import type { UsersController } from './users.controller';
import { updateProfileSchema, updateProgressSchema } from './users.schemas';

export function createUsersRouter(controller: UsersController): Router {
  const router = Router();

  // Se aplica a todas las rutas de este router: ninguna tiene sentido sin sesión
  router.use(requireAuth);

  router.patch('/me', validateBody(updateProfileSchema), controller.updateProfile);
  router.patch('/me/progress', validateBody(updateProgressSchema), controller.updateProgress);

  return router;
}
