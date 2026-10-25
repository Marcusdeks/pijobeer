/**
 * Cómo es un usuario DENTRO del servidor (con todos sus campos, incluidos
 * los secretos). Coincide campo a campo con el modelo User de Prisma.
 *
 * Lo definimos nosotros en vez de usar directamente el tipo de Prisma para
 * que los servicios no dependan de la librería de base de datos: los tests
 * usan un repositorio en memoria que devuelve objetos con esta misma forma.
 *
 * Este objeto NUNCA se envía tal cual al navegador: antes pasa por
 * toUserDto() (user.mapper.ts), que quita el hash y el token.
 */
export interface UserEntity {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationToken: string | null;
  isAdmin: boolean;
  isPremium: boolean;
  maxLevel: number;
  introSeen: boolean;
  /**
   * Trucos de "juego admin", tal cual se guardan (JSON). Es `unknown` a
   * propósito: puede venir de una versión antigua o incompleta, así que
   * siempre se lee a través de readModifiers() (modules/admin/modifiers.ts).
   */
  gameModifiers: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos necesarios para dar de alta un usuario (el resto toma su valor por defecto). */
export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
  verificationToken: string;
}
