/**
 * SERVICIO DE PUNTUACIONES: guardar partidas, ranking global y "mis partidas".
 */
import type { MyScoresResponse, RankingEntry } from '@pijobeer/shared';
import type { ScoreRepository } from './score.repository';
import type { SubmitScoreInput } from './scores.schemas';

/** Cuántas filas tiene el ranking y la tabla de "mis partidas". */
export const RANKING_SIZE = 10;
export const MY_SCORES_SIZE = 10;

export class ScoresService {
  constructor(private readonly scores: ScoreRepository) {}

  /** Registra el resultado de una partida del jugador con sesión. */
  async submit(userId: number, { points, level }: SubmitScoreInput): Promise<void> {
    await this.scores.create(userId, points, level);
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
