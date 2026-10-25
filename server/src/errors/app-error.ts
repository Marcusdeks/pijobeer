/**
 * Error "controlado" de la aplicación.
 *
 * Distinguimos dos tipos de error:
 *
 *   1. AppError: algo que ESPERAMOS que pueda pasar y que es culpa de la
 *      petición (contraseña incorrecta, nombre ya cogido, falta la sesión...).
 *      Lleva el código HTTP y el código de error que verá el cliente.
 *
 *   2. Cualquier otro Error: un fallo inesperado (la BBDD se ha caído, un bug).
 *      El manejador de errores lo registra en el log y responde un 500
 *      genérico, sin enseñar detalles internos al navegador.
 *
 * Los servicios lanzan AppError con `throw` y se olvidan: no tienen que
 * saber nada de Express ni de cómo se construye la respuesta HTTP.
 */
import type { ErrorCode } from '@pijobeer/shared';

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    /** Código HTTP: 400, 401, 404, 409... */
    public readonly status: number,
    /** Código estable que el cliente traduce (ver @pijobeer/shared/error-codes). */
    public readonly code: ErrorCode,
    /** Texto para desarrolladores (logs, pruebas con Postman). El jugador NO lo ve. */
    message: string,
    /** Detalle por campo, solo en errores de validación. */
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }

  // ---- Atajos para los casos más habituales, para escribir menos y con menos errores ----

  static badRequest(code: ErrorCode, message: string, details?: ErrorDetail[]): AppError {
    return new AppError(400, code, message, details);
  }

  static unauthorized(
    code: ErrorCode = 'UNAUTHENTICATED',
    message = 'Authentication required',
  ): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(code: ErrorCode, message: string): AppError {
    return new AppError(403, code, message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(code: ErrorCode, message: string): AppError {
    return new AppError(409, code, message);
  }
}
