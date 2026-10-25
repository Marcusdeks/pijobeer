/**
 * PUNTO DE ENTRADA DEL SERVIDOR.
 *
 * Solo hace tres cosas: construir la app con sus dependencias reales,
 * ponerla a escuchar en el puerto y apagarla limpiamente cuando toca.
 *
 * Arranque en desarrollo:  npm run dev   (se reinicia solo al guardar)
 */
import { createApp } from './app';
import { env } from './config/env';
import { buildDependencies } from './container';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const app = createApp(buildDependencies());

const server = app.listen(env.PORT, () => {
  logger.info(`🍺 Pijo Beer API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

/**
 * Apagado ordenado ("graceful shutdown").
 *
 * Cuando el sistema pide parar el proceso (Ctrl+C, un redespliegue en
 * producción), no cortamos de golpe: dejamos de aceptar peticiones nuevas,
 * esperamos a que terminen las que están a medias y cerramos la conexión
 * con la BBDD. Así ningún jugador se queda con una partida a medio guardar.
 */
function shutdown(signal: string): void {
  logger.info(`${signal} recibido, cerrando servidor...`);

  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Servidor cerrado correctamente');
    process.exit(0);
  });

  // Si algo se queda colgado, forzamos la salida a los 10 segundos
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
