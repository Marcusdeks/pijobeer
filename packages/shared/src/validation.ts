/**
 * Reglas de validación de los datos de usuario.
 *
 * Se usan en DOS sitios a propósito:
 *   - En el cliente, para avisar al instante (atributos del <input>).
 *   - En el servidor, que es quien manda: el navegador se puede saltar,
 *     así que el servidor SIEMPRE vuelve a comprobarlo todo.
 *
 * Al compartir las constantes, nunca puede pasar que un nombre sea válido
 * en el formulario y el servidor lo rechace (o al revés).
 */

/** Longitud mínima y máxima del nombre de usuario. */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

/**
 * Caracteres permitidos en el nombre de usuario: letras sin tilde, números y "_".
 * Sin espacios ni símbolos para que sirva sin ambigüedad como alternativa al
 * email a la hora de iniciar sesión (y no pueda confundirse con un email: no lleva "@").
 */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * Mismo patrón en forma de texto, para el atributo HTML `pattern` del input.
 * (El atributo no admite un objeto RegExp, solo su contenido).
 */
export const USERNAME_PATTERN_HTML = '[a-zA-Z0-9_]+';

/** Longitud mínima de la contraseña. */
export const PASSWORD_MIN_LENGTH = 6;

/**
 * Longitud máxima de la contraseña. Existe por una limitación de bcrypt:
 * solo tiene en cuenta los primeros 72 bytes. Si dejáramos pasar contraseñas
 * más largas, dos contraseñas distintas podrían dar el mismo hash.
 */
export const PASSWORD_MAX_LENGTH = 72;

/** Longitud máxima del email (igual que la columna de la BBDD). */
export const EMAIL_MAX_LENGTH = 120;
