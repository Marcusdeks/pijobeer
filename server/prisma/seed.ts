/**
 * SEMILLA: crea (o actualiza) la cuenta de administrador.
 *
 *   npm run db:seed
 *
 * Los datos de la cuenta salen de las variables de entorno ADMIN_USERNAME,
 * ADMIN_EMAIL y ADMIN_PASSWORD (server/.env) y NUNCA se escriben en el
 * código: este archivo se publica en el repositorio público, el .env no.
 *
 * Se puede ejecutar tantas veces como se quiera: si la cuenta ya existe, se
 * actualizan su contraseña y sus permisos ("upsert" = update + insert).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const { ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD, BCRYPT_ROUNDS = '12' } = process.env;

if (!ADMIN_USERNAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Faltan ADMIN_USERNAME, ADMIN_EMAIL o ADMIN_PASSWORD en server/.env');
  process.exit(1);
}

const prisma = new PrismaClient();

const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, Number(BCRYPT_ROUNDS));
const admin = {
  email: ADMIN_EMAIL.toLowerCase(),
  passwordHash,
  isAdmin: true,
  // La cuenta de admin no necesita confirmar el email
  emailVerified: true,
  verificationToken: null,
};

const user = await prisma.user.upsert({
  where: { username: ADMIN_USERNAME },
  update: admin,
  create: { username: ADMIN_USERNAME, ...admin },
});

console.log(`✔ Administrador "${user.username}" listo (id ${user.id})`);
await prisma.$disconnect();
