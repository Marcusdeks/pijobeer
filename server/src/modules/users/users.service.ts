/**
 * SERVICIO DE USUARIOS: perfil (nombre y contraseña) y progreso en el juego.
 *
 * Sustituye a perfil.php y progreso.php, con las mismas reglas:
 *   - Para cambiar cualquier dato hay que dar la contraseña ACTUAL: si alguien
 *     se sienta en tu ordenador con la sesión abierta, no puede robarte la cuenta.
 *   - El progreso solo puede subir, nunca bajar.
 */
import type { UpdateProfileResponse, UserDto } from '@pijobeer/shared';
import { AppError } from '../../errors/app-error';
import { UniqueConstraintError } from '../../errors/unique-constraint-error';
import type { PasswordHasher } from '../auth/password-hasher';
import type { UserEntity } from './user.entity';
import { toUserDto } from './user.mapper';
import type { UserRepository } from './user.repository';
import type { UpdateProfileInput, UpdateProgressInput } from './users.schemas';

export class UsersService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  /**
   * Cambia el nombre de usuario, la contraseña, o ambos.
   *
   * @throws {AppError}
   *   400 WRONG_CURRENT_PASSWORD | NOTHING_TO_UPDATE | PASSWORDS_DO_NOT_MATCH
   *   409 USERNAME_TAKEN
   */
  async updateProfile(userId: number, input: UpdateProfileInput): Promise<UpdateProfileResponse> {
    const user = await this.getExistingUser(userId);

    // 1. Confirmar identidad con la contraseña actual.
    //    Es un 400 y no un 401 a propósito: el cliente interpreta 401 como
    //    "se ha cerrado tu sesión", y aquí la sesión sigue siendo válida.
    if (!(await this.hasher.verify(input.currentPassword, user.passwordHash))) {
      throw AppError.badRequest('WRONG_CURRENT_PASSWORD', 'Current password is incorrect');
    }

    // 2. ¿Qué quiere cambiar? Escribir el mismo nombre que ya tiene no cuenta como cambio.
    const changesUsername = input.username !== undefined && input.username !== user.username;
    const changesPassword = input.newPassword !== undefined;

    if (!changesUsername && !changesPassword) {
      throw AppError.badRequest('NOTHING_TO_UPDATE', 'Nothing to update');
    }

    if (changesPassword && input.newPassword !== input.newPasswordConfirm) {
      throw AppError.badRequest('PASSWORDS_DO_NOT_MATCH', 'New passwords do not match');
    }

    // El tercer parámetro excluye al propio usuario de la búsqueda
    if (
      changesUsername &&
      (await this.users.existsByEmailOrUsername(null, input.username!, userId))
    ) {
      throw AppError.conflict('USERNAME_TAKEN', 'Username already taken');
    }

    // 3. Guardar solo lo que cambia: si solo cambia el nombre, el hash no se recalcula.
    let updated: UserEntity;
    try {
      updated = await this.users.update(userId, {
        ...(changesUsername && { username: input.username }),
        ...(changesPassword && { passwordHash: await this.hasher.hash(input.newPassword!) }),
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw AppError.conflict('USERNAME_TAKEN', 'Username already taken');
      }
      throw error;
    }

    const changed: UpdateProfileResponse['changed'] = [];
    if (changesUsername) changed.push('username');
    if (changesPassword) changed.push('password');

    return { user: toUserDto(updated), changed };
  }

  /**
   * Guarda el progreso del jugador. Solo se aplica lo que venga en la petición.
   *
   * Nota de seguridad: el servidor confía en que el cliente solo pide subir de
   * nivel cuando de verdad lo ha conseguido. Un antitrampas real exigiría que
   * el servidor simulara o validara la partida, algo desproporcionado para
   * este juego; lo que SÍ garantizamos es que no se puedan inventar niveles.
   */
  async updateProgress(userId: number, input: UpdateProgressInput): Promise<UserDto> {
    if (input.maxLevel !== undefined) {
      await this.users.raiseMaxLevel(userId, input.maxLevel);
    }
    if (input.introSeen) {
      await this.users.markIntroSeen(userId);
    }

    // Devolvemos el usuario actualizado para que el cliente se sincronice
    return toUserDto(await this.getExistingUser(userId));
  }

  /** El token era válido pero la cuenta ya no existe: se trata como sesión caducada. */
  private async getExistingUser(userId: number): Promise<UserEntity> {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized();
    return user;
  }
}
