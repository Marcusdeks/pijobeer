/**
 * Tipos de las peticiones y respuestas de la API REST.
 *
 * Son solo TIPOS (desaparecen al compilar): sirven para que, si el servidor
 * cambia la forma de una respuesta, el cliente deje de compilar en vez de
 * fallar en producción. La validación real de lo que llega la hace el
 * servidor con Zod (ver server/src/modules/<módulo>/<módulo>.schemas.ts).
 *
 * Convención: los nombres de campo van en camelCase, el estándar en JSON/JS.
 */
import type { ErrorCode } from './error-codes';
import type { GameModifiers } from './game-modifiers';

// ============================================================
//  Entidades públicas
// ============================================================

/**
 * Datos del usuario que el servidor puede enseñar al navegador.
 * NUNCA incluye el hash de la contraseña ni el token de verificación.
 */
export interface UserDto {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  /** Permisos de gestión (moderar ranking, etc.). No tiene que ver con pagar. */
  isAdmin: boolean;
  /** Ha comprado las ventajas de pago. No da permisos de gestión. */
  isPremium: boolean;
  /** Nivel más alto desbloqueado. Va en la cuenta para que el progreso le siga. */
  maxLevel: number;
  /** Ya ha visto la historia de la intro (para no forzarla otra vez). */
  introSeen: boolean;
}

// ============================================================
//  Autenticación  (/api/auth)
// ============================================================

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

export interface RegisterResponse {
  /**
   * SOLO EN DESARROLLO: enlace de verificación, porque en local no se envían
   * correos reales. En producción el servidor NUNCA lo devuelve (si lo
   * hiciera, cualquiera podría verificar una cuenta sin acceso a ese email).
   */
  devVerificationUrl?: string;
}

export interface LoginRequest {
  /** Email o nombre de usuario, indistintamente. */
  identifier: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  /** Para saludar al jugador por su nombre en la pantalla de confirmación. */
  username: string;
}

/** Respuesta común de los endpoints que devuelven al usuario actual. */
export interface UserResponse {
  user: UserDto;
}

/** GET /api/auth/me: `user` es null si no hay sesión iniciada. */
export interface MeResponse {
  user: UserDto | null;
}

// ============================================================
//  Perfil y progreso  (/api/users/me)
// ============================================================

export interface UpdateProfileRequest {
  /** Obligatoria SIEMPRE: evita que alguien con tu sesión abierta te robe la cuenta. */
  currentPassword: string;
  /** Opcional: solo si se quiere cambiar. */
  username?: string;
  /** Opcional: solo si se quiere cambiar. */
  newPassword?: string;
  newPasswordConfirm?: string;
}

export interface UpdateProfileResponse {
  user: UserDto;
  /** Qué ha cambiado de verdad, para que el cliente muestre el mensaje adecuado. */
  changed: Array<'username' | 'password'>;
}

export interface UpdateProgressRequest {
  /** Nivel recién desbloqueado. El servidor solo lo aplica si es MAYOR que el actual. */
  maxLevel?: number;
  introSeen?: boolean;
}

// ============================================================
//  Puntuaciones  (/api/scores)
// ============================================================

export interface SubmitScoreRequest {
  points: number;
  level: number;
}

export interface RankingEntry {
  username: string;
  bestScore: number;
}

export interface RankingResponse {
  ranking: RankingEntry[];
}

export interface ScoreDto {
  points: number;
  level: number;
  /** Fecha en formato ISO 8601 (p. ej. "2026-10-23T18:30:00.000Z"). */
  playedAt: string;
}

export interface MyScoresResponse {
  /** Las mejores partidas del jugador, de más a menos puntos. */
  scores: ScoreDto[];
  bestScore: number;
  gamesPlayed: number;
}

// ============================================================
//  Juego admin  (/api/admin, solo administradores)
// ============================================================

/** GET/PUT /api/admin/modifiers: los trucos actuales del administrador. */
export interface ModifiersResponse {
  modifiers: GameModifiers;
}

/** Un mensaje de la conversación con el agente (solo texto). */
export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** POST /api/admin/agent: la conversación entera, terminando en el mensaje nuevo del admin. */
export interface AgentRequest {
  messages: AgentMessage[];
}

export interface AgentResponse {
  /** Respuesta del agente para mostrar en el chat. */
  reply: string;
  /** Los trucos tal y como han quedado después de lo que haya hecho el agente. */
  modifiers: GameModifiers;
}

// ============================================================
//  Errores
// ============================================================

/**
 * Forma de TODAS las respuestas de error de la API (códigos HTTP 4xx/5xx).
 * `details` solo aparece en errores de validación: indica qué campo ha fallado.
 */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}
