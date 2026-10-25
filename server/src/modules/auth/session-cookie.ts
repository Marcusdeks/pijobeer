/**
 * La cookie donde viaja el token de sesión.
 *
 * Por qué una cookie y no localStorage:
 *   Con "httpOnly", el JavaScript de la página NO puede leer la cookie. Si
 *   algún día se colara un script malicioso (ataque XSS), no podría robar la
 *   sesión. Un token en localStorage, en cambio, lo lee cualquier script.
 *
 * Opciones:
 *   - httpOnly: invisible para JavaScript (ver arriba).
 *   - secure: solo viaja por HTTPS. En local (http://localhost) hay que
 *     desactivarlo, si no el navegador nunca la enviaría.
 *   - sameSite "lax": el navegador no la manda en peticiones que otra web
 *     dispare contra nuestra API (protección contra ataques CSRF).
 *   - path "/api": solo se envía a la API, no al descargar imágenes o CSS.
 */
import type { CookieOptions, Response } from 'express';
import { env, isProduction } from '../../config/env';

export const SESSION_COOKIE_NAME = 'pb_session';

const SESSION_MAX_AGE_MS = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/api',
};

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...baseOptions, maxAge: SESSION_MAX_AGE_MS });
}

export function clearSessionCookie(res: Response): void {
  // Para borrar una cookie hay que repetir las mismas opciones con las que se creó
  res.clearCookie(SESSION_COOKIE_NAME, baseOptions);
}
