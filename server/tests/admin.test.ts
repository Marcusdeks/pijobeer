/**
 * Tests de "juego admin": permisos y trucos.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GAME_MODIFIERS } from '@pijobeer/shared';
import { buildTestApp } from './helpers/test-app';

describe('/api/admin', () => {
  let ctx: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    ctx = buildTestApp();
  });

  /** Crea una cuenta verificada (admin o no) y devuelve un "navegador" con la sesión iniciada. */
  async function loggedInAs(username: string, { admin = false } = {}) {
    const password = 'secreto123';
    await request(ctx.app)
      .post('/api/auth/register')
      .send({ username, email: `${username}@example.com`, password, passwordConfirm: password })
      .expect(201);
    const user = ctx.users.rows.find((u) => u.username === username)!;
    user.emailVerified = true;
    user.isAdmin = admin;

    const browser = request.agent(ctx.app);
    await browser.post('/api/auth/login').send({ identifier: username, password }).expect(200);
    return { browser, user };
  }

  it('sin sesión responde 401 y sin ser admin 403', async () => {
    await request(ctx.app).get('/api/admin/modifiers').expect(401);

    const { browser } = await loggedInAs('jugador');
    const res = await browser.get('/api/admin/modifiers').expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('un admin empieza sin trucos', async () => {
    const { browser } = await loggedInAs('jefe', { admin: true });
    const res = await browser.get('/api/admin/modifiers').expect(200);
    expect(res.body.modifiers).toEqual(DEFAULT_GAME_MODIFIERS);
  });

  it('cambia trucos a mano, solo los campos enviados', async () => {
    const { browser, user } = await loggedInAs('jefe', { admin: true });

    await browser.put('/api/admin/modifiers').send({ killsToComplete: 2 }).expect(200);
    const res = await browser.put('/api/admin/modifiers').send({ invincible: true }).expect(200);

    expect(res.body.modifiers).toMatchObject({
      killsToComplete: 2,
      invincible: true,
      enemySpeed: 1,
    });
    expect(user.gameModifiers).toMatchObject({ killsToComplete: 2, invincible: true });
  });

  it('rechaza valores fuera de rango y campos que no existen', async () => {
    const { browser } = await loggedInAs('jefe', { admin: true });
    await browser.put('/api/admin/modifiers').send({ enemySpeed: 50 }).expect(400);
    await browser.put('/api/admin/modifiers').send({ godMode: true }).expect(400);
  });

  it('volver a los valores normales deja la cuenta sin trucos guardados', async () => {
    const { browser, user } = await loggedInAs('jefe', { admin: true });
    await browser.put('/api/admin/modifiers').send({ invincible: true }).expect(200);
    await browser.put('/api/admin/modifiers').send({ invincible: false }).expect(200);
    expect(user.gameModifiers).toBeNull();
  });
});
