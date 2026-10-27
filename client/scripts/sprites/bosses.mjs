/**
 * HOJAS DE JEFES FINALES Y DEL BARRIL PEQUEÑO
 *   -> assets/sprites/bosses.png (+ .json)        barriles jefe
 *   -> assets/sprites/pijo.png (+ .json)          pijo animado
 *   -> assets/sprites/barrel-minion.png (+ .json) barril pequeño
 *
 * Arte fuente: art/bosses/, sobre fondo magenta.
 *
 * Todas las hojas tienen dos filas:
 *   fila 0 -> el dibujo tal cual
 *   fila 1 -> el mismo dibujo en blanco, para el "destello" al recibir un impacto
 *
 * Los barriles van en una columna por jefe. El pijo tiene su propia hoja con
 * una columna por pose (ver PIJO): es el único que se anima.
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
  splitRegion,
  writeMeta,
  writeSheet,
} from './lib.mjs';

/**
 * Barriles jefe, en el orden de las columnas de la hoja (los ids son los de
 * BossId). `height` es su alto en el juego.
 */
const BOSSES = [
  { id: 'wood', file: 'barrel-wood.png', height: 104 },
  { id: 'iron', file: 'barrel-iron.png', height: 104 },
];

const CELL = { width: 96, height: 112 };

/**
 * Pijo: dos imágenes de dos poses cada una, en este orden de columnas:
 *   0, 1    andar de lado (pijo-walk.png)
 *   2, 3    brazo arriba con la botella y brazo estirado al lanzar (pijo-throw.png)
 *
 * Mide lo mismo que el protagonista (TARGET_HEIGHT en player.mjs): la pose más
 * alta de andar mide `height` y el resto se escala con el MISMO factor, para
 * que no cambie de tamaño al lanzar. Todas las poses se apoyan por los pies en
 * `feetY` y se centran a lo ancho, como el jugador.
 */
const PIJO = {
  files: ['pijo-walk.png', 'pijo-throw.png'],
  height: 66,
  cell: { width: 72, height: 80 },
  feetY: 78,
};

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
  await buildPijoSheet();
  await buildMinionSheet();
}

async function buildPijoSheet() {
  const { cell, feetY } = PIJO;
  const images = await Promise.all(
    PIJO.files.map((file) => loadWithoutBackground(path.join(ART_DIR, 'bosses', file))),
  );
  // Dos poses por imagen; lo que sobre son motas de ruido
  const poses = images.flatMap((image) =>
    splitRegion(image, fullRegion(image), { axis: 'x', count: 2, extras: 'drop' }).map((box) => ({
      image,
      box,
    })),
  );
  const tallestWalk = Math.max(poses[0].box.height, poses[1].box.height);
  const scale = PIJO.height / tallestWalk;

  const layers = [];
  for (const [column, { image, box }] of poses.entries()) {
    const sprite = await extractScaled(image, box, scale);
    if (sprite.width > cell.width || sprite.height > feetY) {
      console.warn(`⚠️  pijo pose ${column}: ${sprite.width}x${sprite.height} no cabe entera`);
    }
    const left = column * cell.width + (cell.width - sprite.width) / 2;
    const top = feetY - sprite.height;
    layers.push(layer(sprite, left, top), layer(whiteSilhouette(sprite), left, cell.height + top));
    console.log(`  pijo pose ${column} ${sprite.width}x${sprite.height}`);
  }

  const sheetPath = path.join(OUTPUT_DIR, 'pijo.png');
  await writeSheet(sheetPath, cell.width * poses.length, cell.height * 2, layers);
  await writeMeta(path.join(OUTPUT_DIR, 'pijo.json'), {
    frameWidth: cell.width,
    frameHeight: cell.height,
    frames: poses.length,
    // Los pies, centrados: se hacen coincidir con la base de la caja de colisión
    anchor: { x: cell.width / 2, y: feetY },
  });
  console.log(`✔ ${rel(sheetPath)} (${cell.width * poses.length}x${cell.height * 2})`);
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
