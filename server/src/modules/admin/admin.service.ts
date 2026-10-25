/**
 * SERVICIO DE "JUEGO ADMIN": leer y cambiar los trucos del administrador, a
 * mano o a través del agente.
 */
import {
  DEFAULT_GAME_MODIFIERS,
  hasActiveModifiers,
  MAX_LEVEL,
  type AgentMessage,
  type AgentResponse,
  type GameModifiers,
} from '@pijobeer/shared';
import { AppError } from '../../errors/app-error';
import type { UserRepository } from '../users/user.repository';
import type { AgentOperations, GameAgent } from './game-agent';
import { readModifiers, type ModifiersUpdate } from './modifiers';

export class AdminService {
  constructor(
    private readonly users: UserRepository,
    /** null si el servidor no tiene clave de la API de Claude: el panel manual sigue funcionando. */
    private readonly agent: GameAgent | null,
  ) {}

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

  /** Conversación con el agente. @throws {AppError} 503 si no hay agente configurado */
  async chat(userId: number, messages: AgentMessage[]): Promise<AgentResponse> {
    if (!this.agent) {
      throw new AppError(503, 'AGENT_UNAVAILABLE', 'ANTHROPIC_API_KEY is not configured');
    }

    // Las operaciones van ya ligadas a ESTE admin: el agente no puede elegir sobre quién actúa
    const operations: AgentOperations = {
      getModifiers: () => this.getModifiers(userId),
      updateModifiers: (changes) => this.updateModifiers(userId, changes),
      resetModifiers: () => this.resetModifiers(userId),
      unlockAllLevels: () => this.users.raiseMaxLevel(userId, MAX_LEVEL),
    };

    const reply = await this.agent.reply(messages, operations);
    return { reply, modifiers: await this.getModifiers(userId) };
  }
}
