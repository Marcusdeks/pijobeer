/**
 * SERVICIO DE AUTENTICACIÓN: las reglas de negocio del registro y el login.
 *
 * Arquitectura en capas (de fuera hacia dentro):
 *
 *   routes      -> qué URL llama a qué (auth.routes.ts)
 *   controller  -> traduce HTTP <-> llamadas al servicio (auth.controller.ts)
 *   SERVICE     -> AQUÍ: las reglas ("sin email verificado no se entra")
 *   repository  -> guarda y lee de la BBDD (user.repository.ts)
 *
 * Este archivo no conoce Express (no hay req ni res) ni Prisma (no hay SQL).
 * Recibe datos ya validados, aplica las reglas y devuelve un resultado o
 * lanza un AppError. Por eso se puede probar con tests unitarios sin
 * levantar un servidor ni una base de datos.
 *
 * Las dependencias llegan por el constructor ("inyección de dependencias"):
 * en producción son las reales (Prisma, bcrypt, JWT) y en los tests, falsas.
 */
import { randomBytes } from 'node:crypto';
import type { RegisterResponse, UserDto } from '@pijobeer/shared';
import { AppError } from '../../errors/app-error';
import { UniqueConstraintError } from '../../errors/unique-constraint-error';
import type { Mailer } from '../../lib/mailer';
import { toUserDto } from '../users/user.mapper';
import type { UserRepository } from '../users/user.repository';
import type { LoginInput, RegisterInput } from './auth.schemas';
import type { PasswordHasher } from './password-hasher';
import type { TokenService } from './token.service';

export interface AuthServiceOptions {
  /** URL del frontend, para construir el enlace del correo de verificación. */
  clientUrl: string;
  /**
   * SOLO DESARROLLO: devolver el enlace de verificación en la respuesta del
   * registro, porque en local no se mandan correos reales. En producción
   * TIENE que ser false: si no, cualquiera podría verificar una cuenta ajena.
   */
  exposeVerificationUrl: boolean;
}

export interface LoginResult {
  user: UserDto;
  /** Token de sesión; el controlador lo mete en la cookie. */
  token: string;
}

export class AuthService {
  /**
   * Hash "señuelo" para igualar tiempos en el login (ver login()).
   * Se calcula la primera vez que hace falta y se reutiliza.
   */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly mailer: Mailer,
    private readonly options: AuthServiceOptions,
  ) {}

  /**
   * Da de alta una cuenta SIN verificar y envía el correo de verificación.
   * @throws {AppError} 409 EMAIL_OR_USERNAME_TAKEN
   */
  async register(input: RegisterInput): Promise<RegisterResponse> {
    if (await this.users.existsByEmailOrUsername(input.email, input.username)) {
      throw AppError.conflict('EMAIL_OR_USERNAME_TAKEN', 'Email or username already in use');
    }

    const verificationToken = this.generateVerificationToken();

    try {
      await this.users.create({
        username: input.username,
        email: input.email,
        // La contraseña se cifra AQUÍ y solo aquí: es imposible guardarla en claro por despiste
        passwordHash: await this.hasher.hash(input.password),
        verificationToken,
      });
    } catch (error) {
      // Dos registros simultáneos con el mismo nombre (ver UniqueConstraintError)
      if (error instanceof UniqueConstraintError) {
        throw AppError.conflict('EMAIL_OR_USERNAME_TAKEN', 'Email or username already in use');
      }
      throw error;
    }

    const verificationUrl = `${this.options.clientUrl}/verify-email?token=${verificationToken}`;
    await this.mailer.sendVerificationEmail({
      to: input.email,
      username: input.username,
      verificationUrl,
    });

    return this.options.exposeVerificationUrl ? { devVerificationUrl: verificationUrl } : {};
  }

  /**
   * Comprueba credenciales y devuelve el usuario + su token de sesión.
   *
   * Seguridad — un único mensaje para "no existe" y "contraseña mal":
   *   El PHP original distinguía los dos casos, lo que permitía averiguar qué
   *   emails están registrados probando uno a uno ("enumeración de usuarios").
   *   Ahora ambos responden INVALID_CREDENTIALS.
   *
   *   Además, si el usuario no existe comparamos igualmente contra un hash
   *   señuelo. Sin esto, "no existe" respondería en 1 ms y "contraseña mal"
   *   en 250 ms (lo que tarda bcrypt), y midiendo el tiempo se volvería a saber.
   *
   * @throws {AppError} 401 INVALID_CREDENTIALS | 403 EMAIL_NOT_VERIFIED
   */
  async login({ identifier, password }: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmailOrUsername(identifier);

    const passwordOk = user
      ? await this.hasher.verify(password, user.passwordHash)
      : await this.hasher.verify(password, await this.getDummyHash()).then(() => false);

    if (!user || !passwordOk) {
      throw AppError.unauthorized('INVALID_CREDENTIALS', 'Invalid credentials');
    }

    // Se comprueba DESPUÉS de la contraseña: así este aviso solo lo ve el dueño de la cuenta
    if (!user.emailVerified) {
      throw AppError.forbidden('EMAIL_NOT_VERIFIED', 'Email not verified');
    }

    return { user: toUserDto(user), token: this.tokens.sign(user.id) };
  }

  /**
   * Confirma el email a partir del token del enlace.
   * @returns el nombre del jugador, para saludarle en la pantalla de confirmación
   * @throws {AppError} 400 INVALID_VERIFICATION_TOKEN (no existe o ya se usó)
   */
  async verifyEmail(token: string): Promise<{ username: string }> {
    const user = await this.users.findByVerificationToken(token);
    if (!user) {
      throw AppError.badRequest('INVALID_VERIFICATION_TOKEN', 'Invalid or already used token');
    }

    await this.users.markEmailVerified(user.id);
    return { username: user.username };
  }

  /**
   * Devuelve el usuario de la sesión, o null si ya no existe
   * (p. ej. la cuenta se borró mientras tenía la sesión abierta).
   */
  async getCurrentUser(userId: number): Promise<UserDto | null> {
    const user = await this.users.findById(userId);
    return user ? toUserDto(user) : null;
  }

  // ------------------------------------------------------------------

  /**
   * 32 bytes aleatorios en hexadecimal = 64 caracteres.
   * randomBytes usa el generador criptográfico del sistema operativo:
   * imposible de predecir, a diferencia de Math.random().
   */
  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('dummy-password-for-constant-time');
    return this.dummyHash;
  }
}
