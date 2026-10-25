/**
 * HOJA DE LATAS (objetos que se recogen) -> assets/sprites/pickups.png (+ .json)
 *
 * Arte fuente: art/pickups/, una lata por imagen sobre fondo magenta.
 *
 * Resultado: una sola fila con una columna por lata. No tienen animación:
 * caen tal cual y el jugador las recoge al tocarlas.
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

/** Latas, en el orden de las columnas de la hoja (los ids son los de PICKUP_TYPES en config.ts). */
const PICKUPS = [
  { id: 'health', file: 'can-health.png' },
  { id: 'speed', file: 'can-speed.png' },
];

/** Alto de la lata en el juego: algo menor que una botella (46) para que no se confundan. */
const CAN_HEIGHT = 34;

const CELL = { width: 32, height: 40 };

export async function buildPickupSheet() {
  const layers = [];
  const sizes = {};

  for (const [column, pickup] of PICKUPS.entries()) {
    const image = await loadWithoutBackground(path.join(ART_DIR, 'pickups', pickup.file));
    const box = boundingBox(image, fullRegion(image));
    const sprite = await extractScaled(image, box, CAN_HEIGHT / box.height);

    const left = column * CELL.width + (CELL.width - sprite.width) / 2;
    const top = (CELL.height - sprite.height) / 2;
    layers.push(layer(sprite, left, top));
    sizes[pickup.id] = { width: sprite.width, height: sprite.height };

    console.log(`  ${pickup.id.padEnd(6)} ${sprite.width}x${sprite.height}`);
  }

  const sheetPath = path.join(OUTPUT_DIR, 'pickups.png');
  await writeSheet(sheetPath, CELL.width * PICKUPS.length, CELL.height, layers);

  await writeMeta(path.join(OUTPUT_DIR, 'pickups.json'), {
    frameWidth: CELL.width,
    frameHeight: CELL.height,
    pickups: PICKUPS.map((p) => p.id),
    // La lata está centrada en su celda
    anchor: { x: CELL.width / 2, y: CELL.height / 2 },
    // Tamaño real del dibujo: referencia para la caja de colisión
    sizes,
  });

  console.log(`✔ ${rel(sheetPath)} (${CELL.width * PICKUPS.length}x${CELL.height})`);
}
