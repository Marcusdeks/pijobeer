/**
 * Tokens de sesión (JWT) — sustituyen a la sesión de PHP ($_SESSION).
 *
 * ¿Cómo funcionaba antes?
 *   PHP guardaba en el disco del servidor "la sesión abc123 es el usuario 4"
 *   y mandaba al navegador una cookie con "abc123".
 *
 * ¿Cómo funciona ahora?
 *   Al iniciar sesión generamos un JWT: un texto que contiene { sub: 4 }
 *   (sub = "subject", el id del usuario) FIRMADO con JWT_SECRET. El navegador
 *   lo guarda en una cookie y lo devuelve en cada petición. El servidor solo
 *   tiene que comprobar la firma: si alguien cambia el 4 por un 1, la firma
 *   deja de cuadrar y se rechaza. No hace falta guardar nada en el servidor.
 *
 * Importante: un JWT va FIRMADO, no cifrado. Cualquiera puede leer lo que
 * lleva dentro, así que nunca se mete nada secreto (solo el id).
 *
 * Contrapartida conocida: como el servidor no guarda las sesiones, un token
 * no se puede "anular" antes de que caduque. Por eso tiene caducidad
 * (SESSION_TTL_DAYS) y, al cerrar sesión, se borra la cookie del navegador.
 */
import jwt from 'jsonwebtoken';

interface SessionPayload {
  sub: string;
}

export interface TokenService {
  /** Crea un token para el usuario indicado. */
  sign(userId: number): string;
  /** Devuelve el id del usuario si el token es válido y no ha caducado; si no, null. */
  verify(token: string): number | null;
}

export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    /** Validez del token, en segundos. */
    private readonly expiresInSeconds: number,
  ) {}

  sign(userId: number): string {
    // El estándar JWT exige que "sub" sea un texto, de ahí el String()
    const payload: SessionPayload = { sub: String(userId) };
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresInSeconds,
      // Fijamos el algoritmo para que nadie pueda colar un token con otro distinto
      algorithm: 'HS256',
    });
  }

  verify(token: string): number | null {
    try {
      const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
      if (typeof decoded === 'string' || !decoded.sub) return null;

      const userId = Number(decoded.sub);
      return Number.isInteger(userId) ? userId : null;
    } catch {
      // Firma incorrecta, token caducado o mal formado: para nosotros es "no hay sesión"
      return null;
    }
  }
}
