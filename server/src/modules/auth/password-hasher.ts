/**
 * Cifrado y comprobación de contraseñas (equivale a password_hash /
 * password_verify de PHP).
 *
 * bcrypt es un algoritmo LENTO a propósito: tarda ~250 ms por contraseña.
 * Para un usuario que inicia sesión es imperceptible, pero para un atacante
 * que ha robado la BBDD y quiere probar millones de contraseñas, significa
 * años en vez de minutos. "rounds" (coste) controla cuánto tarda.
 *
 * Usamos "bcryptjs" (JavaScript puro) en lugar de "bcrypt" (nativo en C++)
 * porque no necesita compilar nada al instalarse: funciona igual en
 * Windows, Linux y Docker sin herramientas de compilación.
 *
 * Va detrás de una interfaz para que los tests usen un hasher instantáneo.
 */
import bcrypt from 'bcryptjs';

export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, hash: string): Promise<boolean>;
}

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds: number) {}

  hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.rounds);
  }

  verify(plainPassword: string, hash: string): Promise<boolean> {
    // bcrypt.compare saca la "sal" y el coste del propio hash guardado, así
    // que no hace falta guardarlos aparte.
    return bcrypt.compare(plainPassword, hash);
  }
}
