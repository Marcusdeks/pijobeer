/**
 * HOJA DE ENEMIGOS (botellas pijas) -> assets/sprites/enemy-bottles.png (+ .json)
 *
 * Arte fuente: art/enemies/, una imagen por color de botella con 5 frames en fila:
 *   0 cerrada · 1 salta la chapa · 2 explota la espuma · 3 gotea · 4 abierta
 *
 * Resultado: una fila por color y una columna por frame. Las botellas se GIRAN
 * 180° para que el cuello apunte hacia abajo, hacia el jugador: la espuma sale
 * en la misma dirección en la que viajan sus disparos.
 *
 * Alineación: todos los frames se colocan por la BASE de la botella (el culo),
 * que es la única parte que no cambia. La espuma, la chapa y las gotas
 * sobresalen cada una a su manera; si se alinearan por la caja del dibujo,
 * la botella daría saltos al animarse.
 */
import path from 'node:path';
import {
  ART_DIR,
  buildCell,
  centroid,
  extractScaled,
  fullRegion,
  layer,
  loadWithoutBackground,
  OUTPUT_DIR,
  rel,
  rotatePoint,
  splitRegion,
  writeMeta,
  writeSheet,
} from './lib.mjs';

/** Colores de botella, en el orden de las filas de la hoja. */
const VARIANTS = [
  { id: 'pink', file: 'bottle-pink.jpg' },
  { id: 'gold', file: 'bottle-gold.jpg' },
  { id: 'dark', file: 'bottle-dark.jpg' },
];

const FRAMES = 5;

/** Alto en píxeles de la botella cerrada (frame 0, con la chapa) en el juego. */
const BOTTLE_HEIGHT = 46;

/**
 * Celda de cada frame ANTES de girarla (botella de pie). El alto deja sitio
 * por encima para la espuma, que tras el giro queda por debajo de la botella.
 */
const CELL = { width: 56, height: 80 };

/** Dónde va la base de la botella dentro de la celda (antes de girar). */
const BASE = { x: 28, y: 78 };

const ROTATION = 180;

export async function buildEnemySheet() {
  const layers = [];
  let bottleSize = null;

  for (const [row, variant] of VARIANTS.entries()) {
    const image = await loadWithoutBackground(path.join(ART_DIR, 'enemies', variant.file));
    const boxes = splitRegion(image, fullRegion(image), {
      axis: 'x',
      count: FRAMES,
      // Las gotas y la chapa que sale volando son trozos sueltos: se unen a su frame
      minGap: Math.round(image.width * 0.01),
      extras: 'merge',
    });

    // Escala común a los 5 frames de este color, a partir de la botella cerrada
    const scale = BOTTLE_HEIGHT / boxes[0].height;

    for (const [column, box] of boxes.entries()) {
      // Centro horizontal de la base: media de los píxeles de la franja
      // inferior de la botella (ahí no llega nunca la espuma)
      const baseBand = Math.round(boxes[0].height * 0.2);
      const band = { ...box, top: box.top + box.height - baseBand, height: baseBand };
      const baseCenterX = centroid(image, band).x;

      const sprite = await extractScaled(image, box, scale);
      if (column === 0) bottleSize ??= { width: sprite.width, height: sprite.height };

      const left = BASE.x - (baseCenterX - box.left) * scale;
      const top = BASE.y - sprite.height;
      if (top < 0 || left < 0 || left + sprite.width > CELL.width) {
        console.warn(`⚠️  ${variant.id}/frame ${column}: se sale de la celda y se recorta`);
      }

      const cell = await buildCell(CELL.width, CELL.height, [layer(sprite, left, top)], ROTATION);
      layers.push(layer(cell, column * cell.width, row * cell.height));
    }

    console.log(`  ${variant.id.padEnd(5)} escala ${scale.toFixed(3)}`);
  }

  // Girar 180° no cambia el tamaño de la celda (90° o 270° intercambiarían ancho y alto)
  const frameWidth = ROTATION % 180 === 0 ? CELL.width : CELL.height;
  const frameHeight = ROTATION % 180 === 0 ? CELL.height : CELL.width;

  const sheetPath = path.join(OUTPUT_DIR, 'enemy-bottles.png');
  await writeSheet(sheetPath, frameWidth * FRAMES, frameHeight * VARIANTS.length, layers);

  await writeMeta(path.join(OUTPUT_DIR, 'enemy-bottles.json'), {
    frameWidth,
    frameHeight,
    frames: FRAMES,
    variants: VARIANTS.map((v) => v.id),
    // Base de la botella dentro de cada frame YA GIRADO (arriba del todo, centrada)
    anchor: rotatePoint(BASE, CELL.width, CELL.height, ROTATION),
    // Tamaño de la botella cerrada: referencia para la caja de colisión del enemigo
    bottle: bottleSize,
  });

  console.log(`✔ ${rel(sheetPath)} (${frameWidth * FRAMES}x${frameHeight * VARIANTS.length})`);
}
