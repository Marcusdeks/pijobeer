/**
 * HOJAS DE JEFES FINALES Y DEL BARRIL PEQUEÑO
 *   -> assets/sprites/bosses.png (+ .json)
 *   -> assets/sprites/barrel-minion.png (+ .json)
 *
 * Arte fuente: art/bosses/, un personaje por imagen sobre fondo magenta.
 *
 * Resultado: una columna por jefe y dos filas:
 *   fila 0 -> el dibujo tal cual
 *   fila 1 -> el mismo dibujo en blanco, para el "destello" al recibir un impacto
 *
 * El barril pequeño del nivel 4 sale del MISMO dibujo que el jefe de madera,
 * reducido y en su propia hoja (con el mismo par de filas: aguanta 3 impactos
 * y el destello avisa de que cada uno cuenta).
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

/**
 * Jefes, en el orden de las columnas de la hoja (los ids son los de BossId).
 * `height` es su alto en el juego: los barriles miden lo mismo; el pijo es una
 * persona vista desde arriba y algo más pequeña, para que quepan dos a la vez.
 */
const BOSSES = [
  { id: 'wood', file: 'barrel-wood.png', height: 104 },
  { id: 'iron', file: 'barrel-iron.png', height: 104 },
  { id: 'pijo', file: 'pijo.png', height: 96 },
];

const CELL = { width: 96, height: 112 };

/** Barril pequeño: menos de la mitad que el jefe, algo más alto que una botella (46). */
const MINION = { file: 'barrel-wood.png', height: 44, cell: { width: 40, height: 48 } };

export async function buildBossSheet() {
  const layers = [];
  const sizes = {};

  for (const [column, boss] of BOSSES.entries()) {
    const sprite = await loadScaled(boss.file, boss.height);
    const left = column * CELL.width + (CELL.width - sprite.width) / 2;
    const top = (CELL.height - sprite.height) / 2;
    layers.push(layer(sprite, left, top), layer(whiteSilhouette(sprite), left, CELL.height + top));
    sizes[boss.id] = { width: sprite.width, height: sprite.height };

    console.log(`  ${boss.id.padEnd(6)} ${sprite.width}x${sprite.height}`);
  }

  const sheetPath = path.join(OUTPUT_DIR, 'bosses.png');
  await writeSheet(sheetPath, CELL.width * BOSSES.length, CELL.height * 2, layers);

  await writeMeta(path.join(OUTPUT_DIR, 'bosses.json'), {
    frameWidth: CELL.width,
    frameHeight: CELL.height,
    bosses: BOSSES.map((b) => b.id),
    // El dibujo está centrado en su celda
    anchor: { x: CELL.width / 2, y: CELL.height / 2 },
    // Tamaño real del dibujo: referencia para la caja de colisión
    sizes,
  });

  console.log(`✔ ${rel(sheetPath)} (${CELL.width * BOSSES.length}x${CELL.height * 2})`);
  await buildMinionSheet();
}

async function buildMinionSheet() {
  const { cell } = MINION;
  const sprite = await loadScaled(MINION.file, MINION.height);
  const left = (cell.width - sprite.width) / 2;
  const top = (cell.height - sprite.height) / 2;

  const sheetPath = path.join(OUTPUT_DIR, 'barrel-minion.png');
  await writeSheet(sheetPath, cell.width, cell.height * 2, [
    layer(sprite, left, top),
    layer(whiteSilhouette(sprite), left, cell.height + top),
  ]);

  await writeMeta(path.join(OUTPUT_DIR, 'barrel-minion.json'), {
    frameWidth: cell.width,
    frameHeight: cell.height,
    anchor: { x: cell.width / 2, y: cell.height / 2 },
    size: { width: sprite.width, height: sprite.height },
  });

  console.log(
    `✔ ${rel(sheetPath)} (${cell.width}x${cell.height * 2}, barril ${sprite.width}x${sprite.height})`,
  );
}

/** Carga un dibujo sin el fondo y lo escala para que mida `height` de alto. */
async function loadScaled(file, height) {
  const image = await loadWithoutBackground(path.join(ART_DIR, 'bosses', file));
  const box = boundingBox(image, fullRegion(image));
  return extractScaled(image, box, height / box.height);
}

/** Silueta blanca: mismos píxeles visibles, todos en blanco. */
function whiteSilhouette(sprite) {
  const flash = { ...sprite, data: Buffer.from(sprite.data) };
  for (let i = 0; i < flash.data.length; i += 4) {
    if (flash.data[i + 3] > 0) flash.data.fill(255, i, i + 3);
  }
  return flash;
}
