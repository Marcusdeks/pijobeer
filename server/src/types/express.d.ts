/**
 * Amplía el tipo Request de Express con lo que añaden nuestros middlewares.
 *
 * Express no sabe que nuestro middleware "authenticate" mete el id del
 * usuario en la petición; con esta declaración TypeScript lo sabe y deja
 * escribir req.userId en los controladores con autocompletado.
 */
declare global {
  namespace Express {
    interface Request {
      /** Id del usuario con sesión iniciada; undefined si no hay sesión. Lo rellena "authenticate". */
      userId?: number;
    }
  }
}

export {};
