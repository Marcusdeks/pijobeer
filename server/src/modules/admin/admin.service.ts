/**
 * SERVICIO DE "JUEGO ADMIN": leer y cambiar los trucos del administrador.
 */
import { DEFAULT_GAME_MODIFIERS, hasActiveModifiers, type GameModifiers } from '@pijobeer/shared';
import type { UserRepository } from '../users/user.repository';
import { readModifiers, type ModifiersUpdate } from './modifiers';

export class AdminService {
  constructor(private readonly users: UserRepository) {}

  async getModifiers(userId: number): Promise<GameModifiers> {
    const user = await this.users.findById(userId);
    return readModifiers(user?.gameModifiers);
  }

  /** Aplica cambios parciales y devuelve cómo quedan los trucos. */
  async updateModifiers(userId: number, changes: ModifiersUpdate): Promise<GameModifiers> {
    const modifiers = { ...(await this.getModifiers(userId)), ...changes };
    // Sin ningún truco activo se guarda null: la cuenta queda "limpia"
    await this.users.setGameModifiers(userId, hasActiveModifiers(modifiers) ? modifiers : null);
    return modifiers;
  }

  async resetModifiers(userId: number): Promise<GameModifiers> {
    await this.users.setGameModifiers(userId, null);
    return { ...DEFAULT_GAME_MODIFIERS };
  }
}
