/**
 * CONTROLADOR DE USUARIOS (perfil y progreso).
 * Todas sus rutas exigen sesión: el id sale del token, nunca del cuerpo.
 */
import type { Request, Response } from 'express';
import type { UpdateProfileResponse, UserResponse } from '@pijobeer/shared';
import { getAuthUserId } from '../../http/middlewares/authenticate';
import type { UsersService } from './users.service';
import type { UpdateProfileInput, UpdateProgressInput } from './users.schemas';

export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** PATCH /api/users/me — PATCH porque solo se modifica una parte del recurso. */
  updateProfile = async (req: Request, res: Response<UpdateProfileResponse>): Promise<void> => {
    const result = await this.users.updateProfile(
      getAuthUserId(req),
      req.body as UpdateProfileInput,
    );
    res.json(result);
  };

  /** PATCH /api/users/me/progress */
  updateProgress = async (req: Request, res: Response<UserResponse>): Promise<void> => {
    const user = await this.users.updateProgress(
      getAuthUserId(req),
      req.body as UpdateProgressInput,
    );
    res.json({ user });
  };
}
