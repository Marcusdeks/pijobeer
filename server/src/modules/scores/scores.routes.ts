/**
 * RUTAS DE PUNTUACIONES  ->  montadas en /api/scores (ver app.ts)
 *
 *   POST /          Guardar el resultado de una partida   (requiere sesión)
 *   GET  /ranking   Top 10 global                         (público)
 *   GET  /me        Mis mejores partidas y resumen        (requiere sesión)
 */
import { Router } from 'express';
import { requireAuth } from '../../http/middlewares/authenticate';
import { validateBody } from '../../http/middlewares/validate';
import type { ScoresController } from './scores.controller';
import { submitScoreSchema } from './scores.schemas';

export function createScoresRouter(controller: ScoresController): Router {
  const router = Router();

  router.post('/', requireAuth, validateBody(submitScoreSchema), controller.submit);
  router.get('/ranking', controller.ranking);
  router.get('/me', requireAuth, controller.mine);

  return router;
}
