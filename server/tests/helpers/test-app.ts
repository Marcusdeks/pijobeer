/**
 * Utilidades de test: una app completa con dependencias EN MEMORIA.
 *
 * Los repositorios guardan los datos en arrays, el hasher no cifra de verdad
 * (es instantáneo) y el mailer apunta los correos en una lista. El resto
 * (rutas, validación, servicios, JWT, cookies) es el código REAL.
 */
import type { GameModifiers } from '@pijobeer/shared';
import { createApp } from '../../src/app';
import type { Mailer, VerificationEmail } from '../../src/lib/mailer';
import type { PasswordHasher } from '../../src/modules/auth/password-hasher';
import { JwtTokenService } from '../../src/modules/auth/token.service';
import type {
  RankingRow,
  ScoreRecord,
  ScoreRepository,
} from '../../src/modules/scores/score.repository';
import type { CreateUserData, UserEntity } from '../../src/modules/users/user.entity';
import type { UserRepository } from '../../src/modules/users/user.repository';

export class InMemoryUserRepository implements UserRepository {
  readonly rows: UserEntity[] = [];
  private nextId = 1;

  async findById(id: number) {
    return this.rows.find((u) => u.id === id) ?? null;
  }

  async findByEmailOrUsername(identifier: string) {
    return (
      this.rows.find((u) => u.email === identifier.toLowerCase() || u.username === identifier) ??
      null
    );
  }

  async findByVerificationToken(token: string) {
    return this.rows.find((u) => u.verificationToken === token) ?? null;
  }

  async existsByEmailOrUsername(
    email: string | null,
    username: string | null,
    exceptUserId?: number,
  ) {
    return this.rows.some(
      (u) =>
        u.id !== exceptUserId &&
        ((email !== null && u.email === email.toLowerCase()) ||
          (username !== null && u.username === username)),
    );
  }

  async create(data: CreateUserData) {
    const now = new Date();
    const user: UserEntity = {
      id: this.nextId++,
      ...data,
      emailVerified: false,
      isAdmin: false,
      isPremium: false,
      maxLevel: 1,
      introSeen: false,
      gameModifiers: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(user);
    return user;
  }

  async markEmailVerified(id: number) {
    const user = await this.mustFind(id);
    user.emailVerified = true;
    user.verificationToken = null;
  }

  async update(id: number, data: { username?: string; passwordHash?: string }) {
    const user = await this.mustFind(id);
    Object.assign(user, data);
    return user;
  }

  async raiseMaxLevel(id: number, level: number) {
    const user = await this.mustFind(id);
    user.maxLevel = Math.max(user.maxLevel, level);
  }

  async markIntroSeen(id: number) {
    (await this.mustFind(id)).introSeen = true;
  }

  async setGameModifiers(id: number, modifiers: GameModifiers | null) {
    (await this.mustFind(id)).gameModifiers = modifiers;
  }

  private async mustFind(id: number) {
    const user = await this.findById(id);
    if (!user) throw new Error(`User ${id} not found`);
    return user;
  }
}

export class InMemoryScoreRepository implements ScoreRepository {
  readonly rows: Array<ScoreRecord & { userId: number }> = [];

  constructor(private readonly users: InMemoryUserRepository) {}

  async create(userId: number, points: number, level: number) {
    this.rows.push({ userId, points, level, playedAt: new Date() });
  }

  async ranking(limit: number): Promise<RankingRow[]> {
    const best = new Map<number, number>();
    for (const row of this.rows)
      best.set(row.userId, Math.max(best.get(row.userId) ?? 0, row.points));

    return [...best.entries()]
      .map(([userId, bestScore]) => ({
        username: this.users.rows.find((u) => u.id === userId)!.username,
        bestScore,
      }))
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, limit);
  }

  async topByUser(userId: number, limit: number) {
    return this.rows
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.points - a.points)
      .slice(0, limit)
      .map(({ points, level, playedAt }) => ({ points, level, playedAt }));
  }

  async summaryByUser(userId: number) {
    const mine = this.rows.filter((r) => r.userId === userId);
    return { gamesPlayed: mine.length, bestScore: Math.max(0, ...mine.map((r) => r.points)) };
  }
}

/** "Cifra" poniendo un prefijo: suficiente para probar la lógica, sin los 250 ms de bcrypt. */
export const fakeHasher: PasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  verify: async (plain, hash) => hash === `hashed:${plain}`,
};

export class RecordingMailer implements Mailer {
  readonly sent: VerificationEmail[] = [];
  async sendVerificationEmail(email: VerificationEmail) {
    this.sent.push(email);
  }
}

/** Crea una app nueva y vacía para cada test (sin estado compartido entre tests). */
/** Crea una app nueva y vacía para cada test (sin estado compartido entre tests). */
export function buildTestApp() {
  const users = new InMemoryUserRepository();
  const scores = new InMemoryScoreRepository(users);
  const mailer = new RecordingMailer();

  const app = createApp({
    userRepository: users,
    scoreRepository: scores,
    passwordHasher: fakeHasher,
    tokenService: new JwtTokenService('test-secret-de-al-menos-32-caracteres-de-largo', 3600),
    mailer,
    checkDatabase: async () => {},
    config: {
      clientUrl: 'http://localhost:5173',
      exposeVerificationUrl: true,
      rateLimitEnabled: false,
      trustProxy: false,
      httpLogging: false,
    },
  });

  return { app, users, scores, mailer };
}
