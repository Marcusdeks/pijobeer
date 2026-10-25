/**
 * Códigos de error de la API.
 *
 * El servidor NO devuelve frases para el usuario, sino un código estable
 * (p. ej. "USERNAME_TAKEN"). El cliente traduce ese código al idioma del
 * jugador con sus ficheros i18n (clave "errors.USERNAME_TAKEN").
 *
 * Ventajas frente a devolver el texto ya escrito (como hacía el PHP):
 *   - Los mensajes salen en español, inglés o francés sin tocar el servidor.
 *   - El cliente puede reaccionar a un error concreto sin comparar textos.
 *   - Cambiar la redacción de un mensaje no rompe ningún código.
 *
 * Al añadir un código aquí, TypeScript obliga a añadir su traducción
 * (ver el test de i18n del cliente, que compara los tres idiomas).
 */
export const ERROR_CODES = [
  // ---- Genéricos ----
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
  'NETWORK_ERROR', // solo lo genera el cliente: el servidor no ha respondido

  // ---- Autenticación y permisos ----
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'INVALID_VERIFICATION_TOKEN',
  'EMAIL_OR_USERNAME_TAKEN',

  // ---- Perfil ----
  'WRONG_CURRENT_PASSWORD',
  'USERNAME_TAKEN',
  'NOTHING_TO_UPDATE',
  'PASSWORDS_DO_NOT_MATCH',
] as const;

/** Unión de todos los códigos: 'VALIDATION_ERROR' | 'NOT_FOUND' | ... */
export type ErrorCode = (typeof ERROR_CODES)[number];
