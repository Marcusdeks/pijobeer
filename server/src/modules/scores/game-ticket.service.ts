/**
 * TICKET DE PARTIDA: la base del antitrampas de las puntuaciones.
 *
 * Al empezar una partida, el servidor entrega un JWT firmado con JWT_SECRET
 * que dice "el jugador 4 empezó el nivel 2 a esta hora". Al acabar, el
 * navegador lo devuelve junto a los puntos. Como va firmado, el jugador puede
 * leerlo pero no cambiarlo: ni el nivel ni la hora de inicio. Así el servidor
 * sabe cuánto tiempo ha durado la partida sin fiarse de lo que diga el
 * navegador, y rechaza los puntos que no dé tiempo a conseguir (maxPointsFor).
 *
 * No se guarda nada en la base de datos (igual que la sesión, ver
 * token.service.ts). Para que un ticket no sirva como sesión ni al revés:
 *   - el ticket lleva "audience" (aud) y solo se aceptan los que la tienen;
 *   - el jugador va en "uid" y no en "sub", que es lo que exige la sesión.
 *
 * Contrapartida conocida: un ticket se puede usar más de una vez mientras no
 * caduque. Solo serviría para repetir una puntuación posible, y el ranking
 * cuenta el récord de cada jugador, no la suma, así que no le da ventaja.
 */
import jwt from 'jsonwebtoken';

/** Lo que el servidor apunta al empezar una partida. */
export interface GameTicket {
  userId: number;
  level: number;
  /** Hora de inicio en milisegundos (como Date.now()). */
  startedAt: number;
}

export interface GameTicketService {
  /** Crea el ticket de una partida que empieza ahora. */
  sign(userId: number, level: number): string;
  /** Devuelve lo que dice el ticket si es auténtico y no ha caducado; si no, null. */
  verify(token: string): GameTicket | null;
}

/** Marca que distingue un ticket de partida de un token de sesión. */
const AUDIENCE = 'game-ticket';

export class JwtGameTicketService implements GameTicketService {
  constructor(
    private readonly secret: string,
    /** Validez del ticket, en segundos: lo máximo que puede durar una partida. */
    private readonly expiresInSeconds: number,
    /** Reloj, inyectable para poder simular en los tests que ha pasado el tiempo. */
    private readonly now: () => number = Date.now,
  ) {}

  sign(userId: number, level: number): string {
    // iat ("issued at", en segundos) es la hora de inicio: la firma la protege
    const payload = { uid: userId, level, iat: Math.floor(this.now() / 1000) };
    return jwt.sign(payload, this.secret, {
      audience: AUDIENCE,
      expiresIn: this.expiresInSeconds,
      algorithm: 'HS256',
    });
  }

  verify(token: string): GameTicket | null {
    try {
      const decoded = jwt.verify(token, this.secret, {
        audience: AUDIENCE,
        algorithms: ['HS256'],
        // La caducidad se mide con el mismo reloj que la hora de inicio
        clockTimestamp: Math.floor(this.now() / 1000),
      });
      if (typeof decoded === 'string') return null;
      const { uid, level, iat } = decoded;
      if (!Number.isInteger(uid) || !Number.isInteger(level) || typeof iat !== 'number') {
        return null;
      }
      return { userId: uid as number, level: level as number, startedAt: iat * 1000 };
    } catch {
      // Firma incorrecta, caducado, de otro tipo o mal formado: no vale
      return null;
    }
  }
}
