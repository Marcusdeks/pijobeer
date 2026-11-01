/**
 * Catálogo de llamadas a la API, agrupadas por recurso.
 *
 * Los componentes llaman a authApi.login(...) en vez de escribir la URL
 * y el método a mano. Si una ruta cambia en el servidor, se arregla aquí,
 * en un único sitio. Los tipos vienen del paquete compartido, así que el
 * compilador avisa si la forma de una petición o respuesta deja de coincidir.
 */
import type {
  GameModifiers,
  ModifiersResponse,
  LoginRequest,
  MeResponse,
  MyScoresResponse,
  RankingResponse,
  RegisterRequest,
  RegisterResponse,
  StartGameRequest,
  StartGameResponse,
  SubmitScoreRequest,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UpdateProgressRequest,
  UserResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
} from '@pijobeer/shared';
import { request } from './http';

export const authApi = {
  me: () => request<MeResponse>('GET', '/auth/me'),
  login: (data: LoginRequest) => request<UserResponse>('POST', '/auth/login', data),
  register: (data: RegisterRequest) => request<RegisterResponse>('POST', '/auth/register', data),
  logout: () => request('POST', '/auth/logout'),
  verifyEmail: (data: VerifyEmailRequest) =>
    request<VerifyEmailResponse>('POST', '/auth/verify-email', data),
};

export const usersApi = {
  updateProfile: (data: UpdateProfileRequest) =>
    request<UpdateProfileResponse>('PATCH', '/users/me', data),
  updateProgress: (data: UpdateProgressRequest) =>
    request<UserResponse>('PATCH', '/users/me/progress', data),
};

/** Solo administradores (el servidor responde 403 a cualquier otro). */
export const adminApi = {
  getModifiers: () => request<ModifiersResponse>('GET', '/admin/modifiers'),
  updateModifiers: (changes: Partial<GameModifiers>) =>
    request<ModifiersResponse>('PUT', '/admin/modifiers', changes),
};

export const scoresApi = {
  /** Pide el ticket de una partida que empieza (sin él, el servidor no acepta la puntuación). */
  start: (data: StartGameRequest) => request<StartGameResponse>('POST', '/scores/start', data),
  submit: (data: SubmitScoreRequest) => request('POST', '/scores', data),
  ranking: () => request<RankingResponse>('GET', '/scores/ranking'),
  mine: () => request<MyScoresResponse>('GET', '/scores/me'),
};
