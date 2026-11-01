/**
 * SERVICIO DE PUNTUACIONES: empezar y guardar partidas, ranking global y "mis partidas".
 *
 * ANTITRAMPAS. El navegador está en manos del jugador: con F12 puede mandar
 * los puntos que quiera, así que el servidor no se fía de él:
 *   1. Al empezar (start) comprueba que el nivel esté desbloqueado y entrega
 *      un ticket firmado con el nivel y la hora (ver game-ticket.service.ts).
 *   2. Al guardar (submit) exige ese ticket, mide él mismo cuánto ha durado la
 *      partida y rechaza más puntos de los que da tiempo a conseguir
 *      (maxPointsFor), y las partidas de un admin con trucos activos.
 *
 * Lo que NO impide: que alguien espere el tiempo necesario y mande una
 * puntuación posible sin haber jugado. Para eso habría que repetir la partida
 * entera en el servidor; se descartó por ser mucho más pesado.
 */
import {
  hasActiveModifiers,
  maxPointsFor,
  type MyScoresResponse,
  type RankingEntry,
} from '@pijobeer/shared';
import { AppError } from '../../errors/app-error';
import { readModifiers } from '../admin/modifiers';
import type { UserRepository } from '../users/user.repository';
import type { GameTicketService } from './game-ticket.service';
import type { ScoreRepository } from './score.repository';
import type { StartGameInput, SubmitScoreInput } from './scores.schemas';

/** Cuántas filas tiene el ranking y la tabla de "mis partidas". */
export const RANKING_SIZE = 10;
export const MY_SCORES_SIZE = 10;

export class ScoresService {
  constructor(
    private readonly scores: ScoreRepository,
    private readonly users: UserRepository,
    private readonly tickets: GameTicketService,
    /** Reloj, inyectable para simular en los tests que ha pasado el tiempo. */
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Empieza una partida: devuelve su ticket.
   * @throws 403 LEVEL_LOCKED si el jugador aún no ha llegado a ese nivel
   */
  async start(userId: number, { level }: StartGameInput): Promise<string> {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized();
    if (level > user.maxLevel) {
      throw AppError.forbidden('LEVEL_LOCKED', `Level ${level} is not unlocked`);
    }
    return this.tickets.sign(userId, level);
  }

  /**
   * Registra el resultado de una partida del jugador con sesión.
   * @throws 400 GAME_TICKET_INVALID si el ticket es falso, ha caducado o es de otro jugador
   * @throws 403 CHEATS_ACTIVE si es un admin con trucos activos
   * @throws 400 SCORE_NOT_POSSIBLE si son más puntos de los que da tiempo a conseguir
   */
  async submit(userId: number, { ticket, points }: SubmitScoreInput): Promise<void> {
    const game = this.tickets.verify(ticket);
    if (!game || game.userId !== userId) {
      throw AppError.badRequest('GAME_TICKET_INVALID', 'Invalid or expired game ticket');
    }

    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized();
    // Los trucos se guardan en el servidor, así que no hace falta fiarse del navegador
    if (hasActiveModifiers(readModifiers(user.gameModifiers))) {
      throw AppError.forbidden('CHEATS_ACTIVE', 'Games with admin cheats are not ranked');
    }

    const seconds = (this.now() - game.startedAt) / 1000;
    if (points > maxPointsFor(game.level, seconds)) {
      throw AppError.badRequest(
        'SCORE_NOT_POSSIBLE',
        `Too many points for ${Math.round(seconds)} s`,
      );
    }
    await this.scores.create(userId, points, game.level);
  }

  /** Top de jugadores por su mejor puntuación. Es público: no exige sesión. */
  ranking(): Promise<RankingEntry[]> {
    return this.scores.ranking(RANKING_SIZE);
  }

  /** Resumen y mejores partidas del jugador. */
  async mine(userId: number): Promise<MyScoresResponse> {
    // Las dos consultas son independientes: Promise.all las lanza a la vez
    // en lugar de esperar a que termine la primera para empezar la segunda.
    const [records, summary] = await Promise.all([
      this.scores.topByUser(userId, MY_SCORES_SIZE),
      this.scores.summaryByUser(userId),
    ]);

    return {
      // Las fechas viajan en JSON como texto ISO 8601; el cliente las formatea según el idioma
      scores: records.map((record) => ({
        points: record.points,
        level: record.level,
        playedAt: record.playedAt.toISOString(),
      })),
      bestScore: summary.bestScore,
      gamesPlayed: summary.gamesPlayed,
    };
  }
}
