/**
 * CONTROLADOR DE PUNTUACIONES.
 */
import type { Request, Response } from 'express';
import type { MyScoresResponse, RankingResponse } from '@pijobeer/shared';
import { getAuthUserId } from '../../http/middlewares/authenticate';
import type { ScoresService } from './scores.service';
import type { SubmitScoreInput } from './scores.schemas';

export class ScoresController {
  constructor(private readonly scores: ScoresService) {}

  /** POST /api/scores -> 201. El jugador sale de la sesión: nadie puede puntuar a nombre de otro. */
  submit = async (req: Request, res: Response): Promise<void> => {
    await this.scores.submit(getAuthUserId(req), req.body as SubmitScoreInput);
    res.status(201).end();
  };

  /** GET /api/scores/ranking */
  ranking = async (_req: Request, res: Response<RankingResponse>): Promise<void> => {
    res.json({ ranking: await this.scores.ranking() });
  };

  /** GET /api/scores/me */
  mine = async (req: Request, res: Response<MyScoresResponse>): Promise<void> => {
    res.json(await this.scores.mine(getAuthUserId(req)));
  };
}
