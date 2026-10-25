/**
 * GENERADOR DE TODAS LAS HOJAS DE SPRITES
 *
 *   npm run sprites            (desde la raíz o desde client/)
 *
 * Lee el arte fuente de client/art/ y genera en client/src/assets/sprites/
 * las hojas (PNG) que usa el juego, con sus metadatos (JSON).
 *
 * Por qué un script y no montar las hojas a mano:
 *   - Si se retoca o se sustituye un dibujo, se regenera todo con un comando.
 *   - Todos los frames salen con la MISMA escala y alineados por el mismo
 *     punto (pies, base de la botella...). A mano es casi imposible y la
 *     animación "bailaría".
 *
 * Cada hoja vive en su propio módulo de scripts/sprites/; las herramientas
 * comunes (quitar el fondo, detectar frames, escalar, girar) están en lib.mjs.
 */
import { buildAlleySheets } from './sprites/alleys.mjs';
import { buildBossSheet } from './sprites/bosses.mjs';
import { buildEnemySheet } from './sprites/enemies.mjs';
import { buildPickupSheet } from './sprites/pickups.mjs';
import { buildPlayerSheet } from './sprites/player.mjs';
import { buildProjectileSheets } from './sprites/projectiles.mjs';

const builders = [
  ['Jugador', buildPlayerSheet],
  ['Enemigos', buildEnemySheet],
  ['Jefes finales', buildBossSheet],
  ['Proyectiles', buildProjectileSheets],
  ['Latas', buildPickupSheet],
  ['Callejones', buildAlleySheets],
];

for (const [name, build] of builders) {
  console.log(`\n${name}`);
  try {
    await build();
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    process.exit(1);
  }
}
