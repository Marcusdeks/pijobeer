/**
 * @pijobeer/shared — punto de entrada del paquete compartido.
 *
 * Este paquete es el "contrato" entre el navegador y el servidor. Todo lo
 * que ambos lados deben saber IGUAL vive aquí y solo aquí:
 *
 *   - Reglas de validación (longitud del nombre, de la contraseña...)
 *   - Los niveles del juego (cuántos hay y cómo se desbloquean)
 *   - La forma exacta de las peticiones y respuestas de la API
 *   - Los códigos de error que puede devolver el servidor
 *
 * En el proyecto original, por ejemplo, el número de niveles estaba escrito
 * dos veces (niveles.js y comun.php) y había que acordarse de cambiar ambos.
 * Aquí se cambia una vez y TypeScript avisa en cliente y servidor si algo
 * deja de encajar.
 *
 * Nota: el paquete se consume directamente como código TypeScript (no se
 * compila por separado); Vite y tsup lo empaquetan junto a quien lo importa.
 */
export * from './validation';
export * from './levels';
export * from './game-modifiers';
export * from './difficulty';
export * from './game-rules';
export * from './api-types';
export * from './error-codes';
