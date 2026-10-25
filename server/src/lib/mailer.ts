/**
 * Envío de correos.
 *
 * Todavía no hay un proveedor de correo conectado (haría falta una cuenta en
 * Resend, SendGrid, Amazon SES...). Mientras tanto, ConsoleMailer escribe el
 * enlace de verificación en el log del servidor.
 *
 * Al tenerlo detrás de una interfaz, conectar un proveedor real consiste en
 * crear otra clase (p. ej. ResendMailer implements Mailer) y cambiar UNA
 * línea en container.ts. Ningún servicio se entera del cambio.
 */
import type { Logger } from 'pino';

export interface VerificationEmail {
  to: string;
  username: string;
  verificationUrl: string;
}

export interface Mailer {
  sendVerificationEmail(email: VerificationEmail): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  constructor(private readonly logger: Logger) {}

  async sendVerificationEmail({ to, username, verificationUrl }: VerificationEmail): Promise<void> {
    this.logger.info(
      { to, username, verificationUrl },
      '📧 [dev] Email de verificación (no se envía de verdad)',
    );
  }
}
