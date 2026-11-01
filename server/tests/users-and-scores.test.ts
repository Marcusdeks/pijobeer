/**
 * Tests de integración del perfil, el progreso y las puntuaciones.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_LEVEL, maxPointsFor } from '@pijobeer/shared';
import { buildTestApp } from './helpers/test-app';

describe('perfil, progreso y puntuaciones', () => {
  let ctx: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    ctx = buildTestApp();
  });

  /** Crea una cuenta verificada y devuelve un "navegador" con la sesión iniciada. */
  async function loggedInAs(username: string, password = 'secreto123') {
    await request(ctx.app)
      .post('/api/auth/register')
      .send({ username, email: `${username}@example.com`, password, passwordConfirm: password })
      .expect(201);
    const user = ctx.users.rows.find((u) => u.username === username)!;
    user.emailVerified = true;

    const browser = request.agent(ctx.app);
    await browser.post('/api/auth/login').send({ identifier: username, password }).expect(200);
    return browser;
  }

  describe('rutas protegidas', () => {
    it.each([
      ['patch', '/api/users/me'],
      ['patch', '/api/users/me/progress'],
      ['post', '/api/scores/start'],
      ['post', '/api/scores'],
      ['get', '/api/scores/me'],
    ] as const)('%s %s responde 401 sin sesión', async (method, url) => {
      const res = await request(ctx.app)[method](url).send({}).expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('exige la contraseña actual correcta', async () => {
      const browser = await loggedInAs('pepe');
      const res = await browser
        .patch('/api/users/me')
        .send({ currentPassword: 'mal', username: 'pepe2' })
        .expect(400);
      expect(res.body.error.code).toBe('WRONG_CURRENT_PASSWORD');
    });

    it('cambia el nombre sin tocar la contraseña', async () => {
      const browser = await loggedInAs('pepe');
      const hashBefore = ctx.users.rows[0]!.passwordHash;

      const res = await browser
        .patch('/api/users/me')
        .send({ currentPassword: 'secreto123', username: 'pepe_heavy', newPassword: '' })
        .expect(200);

      expect(res.body).toMatchObject({ user: { username: 'pepe_heavy' }, changed: ['username'] });
      expect(ctx.users.rows[0]!.passwordHash).toBe(hashBefore);
    });

    it('no deja coger el nombre de otro jugador', async () => {
      await loggedInAs('ocupado');
      const browser = await loggedInAs('pepe');

      const res = await browser
        .patch('/api/users/me')
        .send({ currentPassword: 'secreto123', username: 'ocupado' })
        .expect(409);
      expect(res.body.error.code).toBe('USERNAME_TAKEN');
    });

    it('avisa si no hay nada que cambiar', async () => {
      const browser = await loggedInAs('pepe');
      const res = await browser
        .patch('/api/users/me')
        .send({ currentPassword: 'secreto123', username: 'pepe' })
        .expect(400);
      expect(res.body.error.code).toBe('NOTHING_TO_UPDATE');
    });
  });

  describe('PATCH /api/users/me/progress', () => {
    it('sube de nivel pero nunca baja', async () => {
      const browser = await loggedInAs('pepe');

      await browser.patch('/api/users/me/progress').send({ maxLevel: 2 }).expect(200);
      const res = await browser.patch('/api/users/me/progress').send({ maxLevel: 1 }).expect(200);

      expect(res.body.user.maxLevel).toBe(2);
    });

    it('rechaza niveles que no existen', async () => {
      const browser = await loggedInAs('pepe');
      await browser
        .patch('/api/users/me/progress')
        .send({ maxLevel: MAX_LEVEL + 1 })
        .expect(400);
    });

    it('guarda que la intro ya se ha visto', async () => {
      const browser = await loggedInAs('pepe');
      const res = await browser
        .patch('/api/users/me/progress')
        .send({ introSeen: true })
        .expect(200);
      expect(res.body.user.introSeen).toBe(true);
    });
  });

  describe('/api/scores', () => {
    /** Un ticket de partida recién pedido, para el nivel indicado. */
    async function startGame(browser: ReturnType<typeof request.agent>, level = 1) {
      const res = await browser.post('/api/scores/start').send({ level }).expect(201);
      return res.body.ticket as string;
    }

    /** Juega "por la API": pide el ticket, deja pasar el tiempo y manda los puntos. */
    async function playGame(
      browser: ReturnType<typeof request.agent>,
      { level = 1, points = 100, seconds = 600 } = {},
    ) {
      const ticket = await startGame(browser, level);
      ctx.advanceClock(seconds);
      return browser.post('/api/scores').send({ ticket, points });
    }

    it('rechaza puntuaciones imposibles (no múltiplo de los puntos por enemigo)', async () => {
      const browser = await loggedInAs('pepe');
      const res = await playGame(browser, { points: 15 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('no deja empezar un nivel que aún no se ha desbloqueado', async () => {
      const browser = await loggedInAs('pepe');
      const res = await browser.post('/api/scores/start').send({ level: 2 }).expect(403);
      expect(res.body.error.code).toBe('LEVEL_LOCKED');

      await browser.patch('/api/users/me/progress').send({ maxLevel: 2 }).expect(200);
      await startGame(browser, 2);
    });

    it('sin un ticket auténtico y propio no se guarda nada', async () => {
      const pepe = await loggedInAs('pepe');
      const juan = await loggedInAs('juan');
      const ticketDePepe = await startGame(pepe);
      ctx.advanceClock(600);

      for (const [browser, ticket] of [
        [pepe, 'esto-no-es-un-ticket'],
        [pepe, ticketDePepe.slice(0, -2) + 'xx'], // firma manipulada
        [juan, ticketDePepe], // el de otro jugador
      ] as const) {
        const res = await browser.post('/api/scores').send({ ticket, points: 100 }).expect(400);
        expect(res.body.error.code).toBe('GAME_TICKET_INVALID');
      }
      expect(ctx.scores.rows).toHaveLength(0);
    });

    it('rechaza más puntos de los que da tiempo a conseguir', async () => {
      const browser = await loggedInAs('pepe');
      const max = maxPointsFor(1, 30);

      const tooMany = await playGame(browser, { points: max + 10, seconds: 30 });
      expect(tooMany.status).toBe(400);
      expect(tooMany.body.error.code).toBe('SCORE_NOT_POSSIBLE');

      await playGame(browser, { points: max, seconds: 30 }).then((res) =>
        expect(res.status).toBe(201),
      );
    });

    it('el nivel guardado es el del ticket', async () => {
      const browser = await loggedInAs('pepe');
      await browser.patch('/api/users/me/progress').send({ maxLevel: 2 }).expect(200);
      await playGame(browser, { level: 2 }).then((res) => expect(res.status).toBe(201));
      expect(ctx.scores.rows[0]!.level).toBe(2);
    });

    it('el ticket caduca a las 3 horas', async () => {
      const browser = await loggedInAs('pepe');
      const res = await playGame(browser, { seconds: 3 * 60 * 60 + 1 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GAME_TICKET_INVALID');
    });

    it('el ranking muestra el récord de cada jugador, ordenado', async () => {
      const pepe = await loggedInAs('pepe');
      const juan = await loggedInAs('juan');

      await playGame(pepe, { points: 100 }).then((res) => expect(res.status).toBe(201));
      await playGame(pepe, { points: 300 }).then((res) => expect(res.status).toBe(201));
      await playGame(juan, { points: 200 }).then((res) => expect(res.status).toBe(201));

      const res = await request(ctx.app).get('/api/scores/ranking').expect(200);
      expect(res.body.ranking).toEqual([
        { username: 'pepe', bestScore: 300 },
        { username: 'juan', bestScore: 200 },
      ]);
    });

    it('"mis partidas" devuelve resumen y partidas de mayor a menor', async () => {
      const pepe = await loggedInAs('pepe');
      await playGame(pepe, { points: 100 }).then((res) => expect(res.status).toBe(201));
      await playGame(pepe, { points: 300 }).then((res) => expect(res.status).toBe(201));

      const res = await pepe.get('/api/scores/me').expect(200);
      expect(res.body).toMatchObject({ bestScore: 300, gamesPlayed: 2 });
      expect(res.body.scores.map((s: { points: number }) => s.points)).toEqual([300, 100]);
      expect(typeof res.body.scores[0].playedAt).toBe('string');
    });
  });

  it('las rutas de la API que no existen responden 404 en JSON', async () => {
    const res = await request(ctx.app).get('/api/no-existe').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
