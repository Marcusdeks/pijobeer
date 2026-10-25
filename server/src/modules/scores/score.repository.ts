/**
 * REPOSITORIO DE PUNTUACIONES: la única pieza que habla con la tabla "scores".
 * Evolución de servidor/datos/puntuacion.php (mismo patrón que user.repository.ts).
 */
import type { PrismaClient } from '@prisma/client';

export interface ScoreRecord {
  points: number;
  level: number;
  playedAt: Date;
}

export interface RankingRow {
  username: string;
  bestScore: number;
}

export interface ScoreRepository {
  create(userId: number, points: number, level: number): Promise<void>;

  /** La MEJOR puntuación de cada jugador, de mayor a menor. */
  ranking(limit: number): Promise<RankingRow[]>;

  /** Las mejores partidas de un jugador, de más a menos puntos. */
  topByUser(userId: number, limit: number): Promise<ScoreRecord[]>;

  /** Totales del jugador: partidas jugadas y récord (0 si aún no ha jugado). */
  summaryByUser(userId: number): Promise<{ gamesPlayed: number; bestScore: number }>;
}

export class PrismaScoreRepository implements ScoreRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(userId: number, points: number, level: number): Promise<void> {
    await this.db.score.create({ data: { userId, points, level } });
  }

  async ranking(limit: number): Promise<RankingRow[]> {
    /* Una sola consulta SQL con JOIN + GROUP BY, la misma idea que en PHP:
         MAX(points) + GROUP BY user -> una fila por jugador con su récord.

       Usamos $queryRaw (SQL escrito a mano) porque la API normal de Prisma
       necesitaría dos consultas (agrupar y luego buscar los nombres).

       Ojo: es una "tagged template" (las comillas invertidas van pegadas a
       $queryRaw). Prisma convierte ${limit} en un parámetro seguro, NO lo
       pega como texto: no hay riesgo de inyección SQL. Nunca se debe usar
       $queryRawUnsafe con datos del usuario. */
    const rows = await this.db.$queryRaw<Array<{ username: string; best_score: number }>>`
      SELECT u.username, MAX(s.points)::int AS best_score
      FROM scores s
      JOIN users u ON u.id = s.user_id
      GROUP BY u.id, u.username
      ORDER BY best_score DESC, u.username ASC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({ username: row.username, bestScore: row.best_score }));
  }

  topByUser(userId: number, limit: number): Promise<ScoreRecord[]> {
    return this.db.score.findMany({
      where: { userId },
      orderBy: [{ points: 'desc' }, { playedAt: 'desc' }],
      take: limit,
      select: { points: true, level: true, playedAt: true },
    });
  }

  async summaryByUser(userId: number): Promise<{ gamesPlayed: number; bestScore: number }> {
    const result = await this.db.score.aggregate({
      where: { userId },
      _count: { _all: true },
      _max: { points: true },
    });

    return {
      gamesPlayed: result._count._all,
      // _max.points es null si todavía no hay partidas (equivale al IFNULL del SQL original)
      bestScore: result._max.points ?? 0,
    };
  }
}
