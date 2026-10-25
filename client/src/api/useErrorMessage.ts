/**
 * Convierte cualquier error en un texto para el jugador, en su idioma.
 *
 *   const errorMessage = useErrorMessage();
 *   catch (error) { setError(errorMessage(error)); }
 *
 * Si es un ApiError, se traduce su código ("USERNAME_TAKEN" -> "Ese nombre de
 * usuario ya está cogido."). Cualquier otra cosa es un fallo inesperado y se
 * muestra el mensaje genérico (el detalle técnico va a la consola).
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from './http';

export function useErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation();

  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiError) return t(`errors.${error.code}`);
      console.error(error);
      return t('errors.INTERNAL_ERROR');
    },
    [t],
  );
}
