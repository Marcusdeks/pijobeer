/**
 * Manejador de errores centralizado: el ÚLTIMO middleware de la cadena.
 *
 * Cualquier error que se lance en una ruta (con "throw" o una promesa
 * rechazada) acaba aquí. Express 5 ya captura por sí solo los errores de
 * las funciones async; en Express 4 había que envolver cada ruta a mano.
 *
 * Convierte el error en una respuesta JSON con forma fija (ApiErrorBody):
 *   { "error": { "code": "USERNAME_TAKEN", "message": "...", "details": [...] } }
 *
 * Express reconoce un manejador de errores porque recibe CUATRO parámetros
 * (err, req, res, next). Aunque "next" no se use, tiene que estar.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '@pijobeer/shared';
import { AppError } from '../../errors/app-error';
import { logger } from '../../lib/logger';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // 1. Errores controlados: la respuesta ya viene definida en el propio error
  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    };
    res.status(err.status).json(body);
    return;
  }

  // 2. JSON mal formado en el cuerpo (lo lanza express.json() antes de llegar a la ruta)
  if (err instanceof SyntaxError && 'body' in err) {
    const body: ApiErrorBody = {
      error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body' },
    };
    res.status(400).json(body);
    return;
  }

  // 3. Cualquier otra cosa es un fallo nuestro: se registra con todo el detalle
  //    en el log, pero al navegador solo le llega un mensaje genérico. Enseñar
  //    el error real (rutas de archivos, consultas SQL...) daría pistas a un atacante.
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');

  const body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  };
  res.status(500).json(body);
};

/** Respuesta para rutas de la API que no existen (404 en JSON, no la página HTML de Express). */
export const notFoundHandler: RequestHandler = (req) => {
  throw AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`);
};
