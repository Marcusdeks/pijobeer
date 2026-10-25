/**
 * CLIENTE HTTP: la única función que hace fetch() en toda la aplicación.
 *
 * En el proyecto original, login.js, perfil.js, puntuacion.js y progreso.js
 * repetían cada uno su propio fetch con las mismas cabeceras. Aquí se
 * centraliza para que:
 *   - Todas las peticiones manden la cookie de sesión y hablen JSON.
 *   - Todos los errores lleguen con la MISMA forma (ApiError con su código),
 *     tanto si los devuelve el servidor como si ni siquiera hay conexión.
 *
 * Las rutas son relativas ("/api/..."): en desarrollo Vite las reenvía al
 * servidor (proxy en vite.config.ts) y en producción el propio servidor
 * sirve la web, así que nunca hay que escribir "http://localhost:3000".
 */
import type { ApiErrorBody, ErrorCode } from '@pijobeer/shared';

/** Error de cualquier llamada a la API. `code` se traduce con t(`errors.${code}`). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Hace una petición a la API y devuelve el JSON ya convertido.
 *
 * @typeParam T - forma de la respuesta (viene de @pijobeer/shared/api-types)
 * @throws {ApiError} si el servidor responde con error o no se puede conectar
 */
export async function request<T = void>(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      method,
      // Envía la cookie de sesión (por defecto ya es así en el mismo origen;
      // lo dejamos explícito porque es lo que hace que el servidor sepa quién eres)
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch solo lanza si NO hay respuesta (servidor caído, sin internet...)
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
  }

  // 204 No Content / 201 sin cuerpo: no hay JSON que leer
  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const error = (data as ApiErrorBody | undefined)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? response.statusText,
    );
  }

  return data as T;
}
