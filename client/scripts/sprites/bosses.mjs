/**
 * HOJA DE JEFES FINALES (barriles) -> assets/sprites/bosses.png (+ .json)
 *
 * Arte fuente: art/bosses/, un barril por imagen sobre fondo magenta.
 *
 * Resultado: una columna por jefe y dos filas:
 *   fila 0 -> el barril tal cual
 *   fila 1 -> el mismo barril en blanco, para el "destello" al recibir un impacto
 *
 * El destello se genera aquí y no en el juego porque así no depende de
 * filtros del canvas que no todos los navegadores soportan igual.
 */
import path from 'node:path';
import {
  ART_DIR,
  boundingBox,
  extractScaled,
  fullRegion,
  layer,
  loadWithoutBackground,
  OUTPUT_DIR,
  rel,
  writeMeta,
  writeSheet,
} from './lib.mjs';

/** Jefes, en el orden de las columnas de la hoja. */
const BOSSES = [
  { id: 'blonde', file: 'barrel-blonde.png' },
  { id: 'iron', file: 'barrel-iron.png' },
];

/** Alto del barril en el juego. */
const BOSS_HEIGHT = 104;

const CELL = { width: 96, height: 112 };

export async function buildBossSheet() {
  const layers = [];
  const sizes = {};

  for (const [column, boss] of BOSSES.entries()) {
    const image = await loadWithoutBackground(path.join(ART_DIR, 'bosses', boss.file));
    const box = boundingBox(image, fullRegion(image));
    const sprite = await extractScaled(image, box, BOSS_HEIGHT / box.height);

    // Silueta blanca: mismos píxeles visibles, todos en blanco
    const flash = { ...sprite, data: Buffer.from(sprite.data) };
    for (let i = 0; i < flash.data.length; i += 4) {
      if (flash.data[i + 3] > 0) flash.data.fill(255, i, i + 3);
    }

    const left = column * CELL.width + (CELL.width - sprite.width) / 2;
    const top = (CELL.height - sprite.height) / 2;
    layers.push(layer(sprite, left, top), layer(flash, left, CELL.height + top));
    sizes[boss.id] = { width: sprite.width, height: sprite.height };

    console.log(`  ${boss.id.padEnd(6)} ${sprite.width}x${sprite.height}`);
  }

  const sheetPath = path.join(OUTPUT_DIR, 'bosses.png');
  await writeSheet(sheetPath, CELL.width * BOSSES.length, CELL.height * 2, layers);

  await writeMeta(path.join(OUTPUT_DIR, 'bosses.json'), {
    frameWidth: CELL.width,
    frameHeight: CELL.height,
    bosses: BOSSES.map((b) => b.id),
    // El barril está centrado en su celda
    anchor: { x: CELL.width / 2, y: CELL.height / 2 },
    // Tamaño real del dibujo: referencia para la caja de colisión
    sizes,
  });

  console.log(`✔ ${rel(sheetPath)} (${CELL.width * BOSSES.length}x${CELL.height * 2})`);
}
