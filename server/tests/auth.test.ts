/**
 * Tests de integración de /api/auth: registro, verificación, login, sesión y logout.
 *
 * supertest.agent() se comporta como un navegador: guarda las cookies que
 * le pone el servidor y las devuelve en las siguientes peticiones.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/test-app';

const VALID_USER = {
  username: 'heavy_metal',
  email: 'Heavy@Example.com',
  password: 'secreto123',
  passwordConfirm: 'secreto123',
};

describe('/api/auth', () => {
  let ctx: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    ctx = buildTestApp();
  });

  /** Registra y verifica una cuenta, como haría el jugador pulsando el enlace del correo. */
  async function registerAndVerify() {
    await request(ctx.app).post('/api/auth/register').send(VALID_USER).expect(201);
    const token = new URL(ctx.mailer.sent[0]!.verificationUrl).searchParams.get('token');
    await request(ctx.app).post('/api/auth/verify-email').send({ token }).expect(200);
  }

  describe('POST /register', () => {
    it('crea la cuenta sin verificar, guarda el email en minúsculas y envía el correo', async () => {
      const res = await request(ctx.app).post('/api/auth/register').send(VALID_USER).expect(201);

      expect(res.body.devVerificationUrl).toMatch(/\/verify-email\?token=[a-f0-9]{64}$/);
      expect(ctx.users.rows[0]).toMatchObject({ email: 'heavy@example.com', emailVerified: false });
      expect(ctx.users.rows[0]!.passwordHash).not.toBe(VALID_USER.password);
      expect(ctx.mailer.sent).toHaveLength(1);
    });

    it('rechaza nombres de usuario con caracteres no permitidos', async () => {
      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ ...VALID_USER, username: 'con espacios' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].field).toBe('username');
    });

    it('rechaza contraseñas que no coinciden', async () => {
      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ ...VALID_USER, passwordConfirm: 'otra' })
        .expect(400);

      expect(res.body.error.details[0].field).toBe('passwordConfirm');
    });

    it('rechaza un email o nombre ya registrados (sin distinguir mayúsculas en el email)', async () => {
      await request(ctx.app).post('/api/auth/register').send(VALID_USER).expect(201);

      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ ...VALID_USER, username: 'otro_nombre', email: 'HEAVY@example.com' })
        .expect(409);

      expect(res.body.error.code).toBe('EMAIL_OR_USERNAME_TAKEN');
    });
  });

  describe('POST /verify-email', () => {
    it('no permite reutilizar un enlace ya usado', async () => {
      await registerAndVerify();
      const token = new URL(ctx.mailer.sent[0]!.verificationUrl).searchParams.get('token');

      const res = await request(ctx.app).post('/api/auth/verify-email').send({ token }).expect(400);
      expect(res.body.error.code).toBe('INVALID_VERIFICATION_TOKEN');
    });
  });

  describe('POST /login', () => {
    it('no deja entrar si el email no está verificado', async () => {
      await request(ctx.app).post('/api/auth/register').send(VALID_USER).expect(201);

      const res = await request(ctx.app)
        .post('/api/auth/login')
        .send({ identifier: VALID_USER.username, password: VALID_USER.password })
        .expect(403);

      expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('da el MISMO error para usuario inexistente y contraseña incorrecta (anti-enumeración)', async () => {
      await registerAndVerify();

      const wrongUser = await request(ctx.app)
        .post('/api/auth/login')
        .send({ identifier: 'nadie', password: 'loquesea' })
        .expect(401);
      const wrongPassword = await request(ctx.app)
        .post('/api/auth/login')
        .send({ identifier: VALID_USER.username, password: 'incorrecta' })
        .expect(401);

      expect(wrongUser.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('acepta email o nombre de usuario y pone una cookie httpOnly', async () => {
      await registerAndVerify();

      const res = await request(ctx.app)
        .post('/api/auth/login')
        .send({ identifier: 'heavy@example.com', password: VALID_USER.password })
        .expect(200);

      expect(res.body.user).toMatchObject({ username: 'heavy_metal', maxLevel: 1 });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.headers['set-cookie']?.[0]).toMatch(/pb_session=.+HttpOnly/i);
    });
  });

  describe('GET /me y POST /logout', () => {
    it('devuelve user: null sin sesión', async () => {
      const res = await request(ctx.app).get('/api/auth/me').expect(200);
      expect(res.body).toEqual({ user: null });
    });

    it('recuerda la sesión entre peticiones y la olvida al cerrar sesión', async () => {
      await registerAndVerify();
      const browser = request.agent(ctx.app);

      await browser
        .post('/api/auth/login')
        .send({ identifier: VALID_USER.username, password: VALID_USER.password })
        .expect(200);

      const me = await browser.get('/api/auth/me').expect(200);
      expect(me.body.user.username).toBe('heavy_metal');

      await browser.post('/api/auth/logout').expect(204);
      const after = await browser.get('/api/auth/me').expect(200);
      expect(after.body.user).toBeNull();
    });

    it('ignora una cookie manipulada', async () => {
      const res = await request(ctx.app)
        .get('/api/auth/me')
        .set('Cookie', 'pb_session=token.falso.inventado')
        .expect(200);
      expect(res.body.user).toBeNull();
    });
  });
});
