/**
 * Conexión compartida a PostgreSQL.
 *
 * Equivale a la función bbdd() del PHP original, con una diferencia
 * importante: en PHP cada petición abría y cerraba su conexión. En Node el
 * servidor es UN proceso que vive todo el rato, así que creamos un único
 * PrismaClient al arrancar y lo reutiliza todo el mundo. Por dentro, Prisma
 * mantiene un "pool" (un grupo de conexiones abiertas) y las reparte entre
 * las peticiones que llegan a la vez.
 *
 * Crear un PrismaClient por petición sería un error grave: agotaría las
 * conexiones que admite PostgreSQL en cuanto hubiera algo de tráfico.
 */
import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env';

export const prisma = new PrismaClient({
  // En desarrollo, avisos y errores de Prisma por consola. En producción solo errores.
  log: isProduction ? ['error'] : ['warn', 'error'],
});
