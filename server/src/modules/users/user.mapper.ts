/**
 * Convierte el usuario interno en el que se puede enseñar al navegador.
 *
 * Es el equivalente a la constante CAMPOS_PUBLICOS_USUARIO del PHP, pero
 * más seguro: aquí se ELIGEN uno a uno los campos que salen (lista blanca).
 * Si mañana se añade una columna secreta a la tabla, no se filtra por
 * accidente, porque nadie la habrá añadido aquí.
 */
import type { UserDto } from '@pijobeer/shared';
import type { UserEntity } from './user.entity';

export function toUserDto(user: UserEntity): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    isAdmin: user.isAdmin,
    isPremium: user.isPremium,
    maxLevel: user.maxLevel,
    introSeen: user.introSeen,
  };
}
