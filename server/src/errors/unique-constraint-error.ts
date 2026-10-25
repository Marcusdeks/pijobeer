/**
 * Error que lanzan los repositorios cuando la BBDD rechaza un dato duplicado
 * (columna UNIQUE: email o nombre de usuario).
 *
 * ¿Por qué hace falta si el servicio ya comprueba antes si están cogidos?
 * Por las "condiciones de carrera": si dos personas se registran como "pepe"
 * en el mismo milisegundo, las dos comprobaciones dicen "libre" y las dos
 * intentan guardar. La BBDD solo deja pasar a una; la otra recibe este error.
 * Sin capturarlo, ese segundo jugador vería un error 500 en vez de
 * "ese nombre ya está cogido".
 *
 * Es un error "de datos", no de HTTP: el repositorio no sabe de códigos
 * HTTP. Es el servicio quien decide cómo se le cuenta al usuario.
 */
export class UniqueConstraintError extends Error {
  constructor(
    /** Columnas implicadas, según las indica la BBDD (p. ej. ['username']). */
    public readonly fields: string[],
  ) {
    super(`Unique constraint violated on: ${fields.join(', ')}`);
    this.name = 'UniqueConstraintError';
  }
}
