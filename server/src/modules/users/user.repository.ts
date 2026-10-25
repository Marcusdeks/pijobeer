/**
 * REPOSITORIO DE USUARIOS: la única pieza que habla con la tabla "users".
 *
 * Es la evolución de servidor/datos/usuario.php. Se divide en dos partes:
 *
 *   1. La INTERFAZ (UserRepository): QUÉ operaciones existen.
 *      Los servicios dependen solo de esto; no saben si debajo hay
 *      PostgreSQL, MySQL o un array en memoria.
 *
 *   2. La IMPLEMENTACIÓN (PrismaUserRepository): CÓMO se hacen con Prisma.
 *
 * Gracias a esa separación, los tests sustituyen la implementación por una
 * en memoria (tests/helpers) y prueban toda la lógica sin base de datos.
 *
 * Inyección SQL: Prisma construye siempre consultas parametrizadas (igual
 * que hacía prepare() + bind_param() en PHP), así que los datos del usuario
 * nunca se mezclan con el texto de la consulta.
 */
import type { GameModifiers } from '@pijobeer/shared';
import { Prisma, type PrismaClient } from '@prisma/client';
import { UniqueConstraintError } from '../../errors/unique-constraint-error';
import type { CreateUserData, UserEntity } from './user.entity';

/**
 * Traduce el error de Prisma "valor duplicado" (código P2002) a nuestro
 * UniqueConstraintError, para que los servicios no dependan de Prisma.
 * Cualquier otro error se relanza tal cual.
 */
function rethrowUniqueViolation(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = error.meta?.target;
    throw new UniqueConstraintError(Array.isArray(target) ? target.map(String) : []);
  }
  throw error;
}

export interface UserRepository {
  findById(id: number): Promise<UserEntity | null>;

  /** Busca por email O por nombre de usuario (el login acepta cualquiera de los dos). */
  findByEmailOrUsername(identifier: string): Promise<UserEntity | null>;

  findByVerificationToken(token: string): Promise<UserEntity | null>;

  /**
   * ¿Hay ALGÚN usuario con ese email o ese nombre?
   * @param exceptUserId - id que no cuenta. Al cambiarte el nombre, el tuyo actual no debe dar "ocupado".
   */
  existsByEmailOrUsername(
    email: string | null,
    username: string | null,
    exceptUserId?: number,
  ): Promise<boolean>;

  /** @throws {UniqueConstraintError} si el email o el nombre ya existen. */
  create(data: CreateUserData): Promise<UserEntity>;

  /** Marca el email como verificado y borra el token para que el enlace no se reutilice. */
  markEmailVerified(id: number): Promise<void>;

  /**
   * Actualiza solo los campos que se pasan; los que no vengan, no se tocan.
   * @throws {UniqueConstraintError} si el nuevo nombre ya existe.
   */
  update(id: number, data: { username?: string; passwordHash?: string }): Promise<UserEntity>;

  /**
   * Sube el nivel máximo, pero SOLO si el nuevo es mayor que el actual.
   * El progreso nunca baja (equivale al GREATEST() del SQL original).
   */
  raiseMaxLevel(id: number, level: number): Promise<void>;

  markIntroSeen(id: number): Promise<void>;

  /** Guarda los trucos de "juego admin" (null = sin trucos). */
  setGameModifiers(id: number, modifiers: GameModifiers | null): Promise<void>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}

  findById(id: number): Promise<UserEntity | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmailOrUsername(identifier: string): Promise<UserEntity | null> {
    // Los emails se guardan en minúsculas (ver AuthService.register), así que
    // comparamos el email en minúsculas; el nombre de usuario, tal cual.
    return this.db.user.findFirst({
      where: { OR: [{ email: identifier.toLowerCase() }, { username: identifier }] },
    });
  }

  findByVerificationToken(token: string): Promise<UserEntity | null> {
    return this.db.user.findUnique({ where: { verificationToken: token } });
  }

  async existsByEmailOrUsername(
    email: string | null,
    username: string | null,
    exceptUserId?: number,
  ): Promise<boolean> {
    const conditions = [
      ...(email ? [{ email: email.toLowerCase() }] : []),
      ...(username ? [{ username }] : []),
    ];
    if (conditions.length === 0) return false;

    const count = await this.db.user.count({
      where: {
        OR: conditions,
        // Si no hay que excluir a nadie, "undefined" hace que Prisma ignore el filtro
        ...(exceptUserId !== undefined ? { NOT: { id: exceptUserId } } : {}),
      },
    });
    return count > 0;
  }

  create(data: CreateUserData): Promise<UserEntity> {
    return this.db.user.create({ data }).catch(rethrowUniqueViolation);
  }

  async markEmailVerified(id: number): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: { emailVerified: true, verificationToken: null },
    });
  }

  update(id: number, data: { username?: string; passwordHash?: string }): Promise<UserEntity> {
    return this.db.user.update({ where: { id }, data }).catch(rethrowUniqueViolation);
  }

  async raiseMaxLevel(id: number, level: number): Promise<void> {
    // updateMany permite poner una condición extra en el WHERE:
    // "UPDATE users SET max_level = ? WHERE id = ? AND max_level < ?".
    // Si el jugador ya tenía ese nivel o uno mayor, simplemente no se actualiza ninguna fila.
    await this.db.user.updateMany({
      where: { id, maxLevel: { lt: level } },
      data: { maxLevel: level },
    });
  }

  async markIntroSeen(id: number): Promise<void> {
    await this.db.user.update({ where: { id }, data: { introSeen: true } });
  }

  async setGameModifiers(id: number, modifiers: GameModifiers | null): Promise<void> {
    await this.db.user.update({
      where: { id },
      // Prisma distingue "JSON null" de "columna vacía": DbNull deja la columna a NULL
      data: { gameModifiers: modifiers ? { ...modifiers } : Prisma.DbNull },
    });
  }
}
