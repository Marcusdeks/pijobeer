/**
 * Tests de integración del perfil, el progreso y las puntuaciones.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '@pijobeer/shared';
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
    it('rechaza puntuaciones imposibles (no múltiplo de los puntos por enemigo)', async () => {
      const browser = await loggedInAs('pepe');
      await browser.post('/api/scores').send({ points: 15, level: 1 }).expect(400);
    });

    it('el ranking muestra el récord de cada jugador, ordenado', async () => {
      const pepe = await loggedInAs('pepe');
      const juan = await loggedInAs('juan');

      await pepe.post('/api/scores').send({ points: 100, level: 1 }).expect(201);
      await pepe.post('/api/scores').send({ points: 300, level: 2 }).expect(201);
      await juan.post('/api/scores').send({ points: 200, level: 1 }).expect(201);

      const res = await request(ctx.app).get('/api/scores/ranking').expect(200);
      expect(res.body.ranking).toEqual([
        { username: 'pepe', bestScore: 300 },
        { username: 'juan', bestScore: 200 },
      ]);
    });

    it('"mis partidas" devuelve resumen y partidas de mayor a menor', async () => {
      const pepe = await loggedInAs('pepe');
      await pepe.post('/api/scores').send({ points: 100, level: 1 }).expect(201);
      await pepe.post('/api/scores').send({ points: 300, level: 2 }).expect(201);

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
