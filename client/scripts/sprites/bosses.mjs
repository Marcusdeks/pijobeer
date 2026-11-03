/**
 * HOJAS DE JEFES FINALES Y DE LOS BARRILES PEQUEÑOS
 *   -> assets/sprites/bosses.png (+ .json)        barriles jefe
 *   -> assets/sprites/pijo.png (+ .json)          pijo animado
 *   -> assets/sprites/primo.png (+ .json)         primo pijo animado (nivel 5)
 *   -> assets/sprites/barrel-minion.png (+ .json) barriles pequeños (madera y hierro)
 *
 * Arte fuente: art/bosses/, sobre fondo magenta.
 *
 * Todas las hojas tienen dos filas:
 *   fila 0 -> el dibujo tal cual
 *   fila 1 -> el mismo dibujo en blanco, para el "destello" al recibir un impacto
 *
 * Los barriles van en una columna por jefe. El pijo y el primo, que se
 * animan, tienen cada uno su propia hoja con una columna por pose (ver PIJO y
 * PRIMO); el primo, además, una fila por animación.
 *
 * Los barriles pequeños (niveles 4 y 5) salen de los MISMOS dibujos que los
 * jefes de madera y de hierro, reducidos y en su propia hoja, una columna por
 * barril (con el mismo par de filas: aguantan varios impactos y el destello
 * avisa de que cada uno cuenta).
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

/**
 * Primo pijo (jefe del nivel 5): un grandullón, casi el doble que el
 * protagonista (66). Tres filas, una por animación:
 *   0  andar (primo-walk.png, 4 poses)
 *   1  coger y lanzar un barril de madera (primo-throw-wood.png, 6 poses)
 *   2  lo mismo con uno de hierro (primo-throw-iron.png, 6 poses)
 * Las poses de lanzar son: agacharse a cogerlo, levantarlo, sobre la cabeza,
 * a punto de lanzar, soltándolo y con las manos vacías.
 *
 * Cada imagen se dibujó a una escala distinta, así que cada una se escala por
 * su pose de pie (la más alta de andar y la última de lanzar, con las manos
 * vacías) para que mida `height`: así no cambia de tamaño al lanzar. Como el
 * pijo, todas las poses se apoyan por los pies y se centran a lo ancho; la
 * celda se calcula para que quepa la pose más grande.
 */
const PRIMO = {
  rows: [
    { file: 'primo-walk.png', poses: 4, reference: 'tallest' },
    { file: 'primo-throw-wood.png', poses: 6, reference: 'last' },
    { file: 'primo-throw-iron.png', poses: 6, reference: 'last' },
  ],
  height: 120,
};

/**
 * Barriles pequeños, en el orden de las columnas de su hoja: menos de la mitad
 * que el jefe, algo más altos que una botella (46).
 */
const MINIONS = [
  { id: 'wood', file: 'barrel-wood.png' },
  { id: 'iron', file: 'barrel-iron.png' },
];
const MINION = { height: 44, cell: { width: 40, height: 48 } };

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
  await buildPrimoSheet();
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

async function buildPrimoSheet() {
  const rows = [];
  for (const row of PRIMO.rows) {
    const image = await loadWithoutBackground(path.join(ART_DIR, 'bosses', row.file));
    const boxes = splitRegion(image, fullRegion(image), {
      axis: 'x',
      count: row.poses,
      extras: 'drop',
    });
    const heights = boxes.map((box) => box.height);
    const reference = row.reference === 'last' ? heights.at(-1) : Math.max(...heights);
    const scale = PRIMO.height / reference;
    rows.push(await Promise.all(boxes.map((box) => extractScaled(image, box, scale))));
  }

  // La celda, a la medida de la pose más grande (en par, para centrar sin decimales)
  const sprites = rows.flat();
  const even = (value) => Math.ceil(value / 2) * 2;
  const cell = {
    width: even(Math.max(...sprites.map((sprite) => sprite.width)) + 2),
    height: even(Math.max(...sprites.map((sprite) => sprite.height)) + 2),
  };
  const feetY = cell.height - 1;
  const columns = Math.max(...rows.map((row) => row.length));

  const layers = [];
  for (const [rowIndex, row] of rows.entries()) {
    for (const [column, sprite] of row.entries()) {
      const left = column * cell.width + (cell.width - sprite.width) / 2;
      const top = rowIndex * cell.height + feetY - sprite.height;
      // Debajo de las filas normales, las mismas poses en blanco (destello)
      const flashTop = top + rows.length * cell.height;
      layers.push(layer(sprite, left, top), layer(whiteSilhouette(sprite), left, flashTop));
    }
    const sizes = row.map((sprite) => `${sprite.width}x${sprite.height}`).join(' ');
    console.log(`  primo fila ${rowIndex}: ${sizes}`);
  }

  const sheetPath = path.join(OUTPUT_DIR, 'primo.png');
  const width = cell.width * columns;
  const height = cell.height * rows.length * 2;
  await writeSheet(sheetPath, width, height, layers);
  await writeMeta(path.join(OUTPUT_DIR, 'primo.json'), {
    frameWidth: cell.width,
    frameHeight: cell.height,
    /** Filas de dibujos normales (las del destello van debajo, en el mismo orden). */
    rows: rows.length,
    // Los pies, centrados: se hacen coincidir con la base de la caja de colisión
    anchor: { x: cell.width / 2, y: feetY },
  });
  console.log(`✔ ${rel(sheetPath)} (${width}x${height})`);
}

async function buildMinionSheet() {
  const { cell } = MINION;
  const layers = [];
  const sizes = {};
  for (const [column, minion] of MINIONS.entries()) {
    const sprite = await loadScaled(minion.file, MINION.height);
    const left = column * cell.width + (cell.width - sprite.width) / 2;
    const top = (cell.height - sprite.height) / 2;
    layers.push(layer(sprite, left, top), layer(whiteSilhouette(sprite), left, cell.height + top));
    sizes[minion.id] = { width: sprite.width, height: sprite.height };
    console.log(`  barril pequeño ${minion.id.padEnd(4)} ${sprite.width}x${sprite.height}`);
  }

  const sheetPath = path.join(OUTPUT_DIR, 'barrel-minion.png');
  await writeSheet(sheetPath, cell.width * MINIONS.length, cell.height * 2, layers);

  await writeMeta(path.join(OUTPUT_DIR, 'barrel-minion.json'), {
    frameWidth: cell.width,
    frameHeight: cell.height,
    barrels: MINIONS.map((minion) => minion.id),
    anchor: { x: cell.width / 2, y: cell.height / 2 },
    // Tamaño real del dibujo: referencia para la caja de colisión
    sizes,
  });

  console.log(`✔ ${rel(sheetPath)} (${cell.width * MINIONS.length}x${cell.height * 2})`);
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
