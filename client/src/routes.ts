/**
 * URLs de la aplicación, en un solo sitio.
 *
 * Los componentes escriben <Link to={ROUTES.play}> y no "/play" a mano:
 * si mañana una URL cambia, se cambia aquí y todos los enlaces se
 * actualizan solos (y TypeScript avisa si alguien usa una ruta que no existe).
 */
export const ROUTES = {
  home: '/',
  story: '/story',
  play: '/play',
  controls: '/controls',
  credits: '/credits',
  login: '/login',
  verifyEmail: '/verify-email',
  profile: '/profile',
  scores: '/scores',
  admin: '/admin',
} as const;
