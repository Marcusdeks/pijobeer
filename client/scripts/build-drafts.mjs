/**
 * BORRADORES DE ANIMACIONES (temporal): prepara el arte de imagenes/png/ para
 * revisarlo en la página Animaciones del admin ANTES de meterlo en el juego.
 *
 *   npm run sprites:drafts             (desde la raíz o desde client/)
 *   npm run sprites:drafts -- --watch  (y otra vez cada vez que se guarde un PNG)
 *
 * Cada PNG es una tira de poses en fila. Se procesa con las MISMAS funciones
 * que las hojas del juego (lib.mjs): quitar el fondo magenta, separar las
 * poses por los huecos, escalarlas y apoyarlas por los pies. Así lo que se ve
 * en la página es lo que saldría al implementarlo, fallos incluidos.
 *
 * Cada tira se escala para que su pose más alta mida DRAFT_HEIGHT (lo mismo
 * que el protagonista, para compararlas con él). Además, se anotan avisos de
 * lo que convendría arreglar en el dibujo: fondo que no es magenta, restos
 * fuera de las poses, poses cortadas por el borde.
 *
 * El resultado va a src/assets/drafts/, que git ignora: no llega a ningún
 * repositorio. Se puede borrar cuando se quiera.
 */
import { watch } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  extractScaled,
  fullRegion,
  layer,
  loadWithoutBackground,
  rel,
  ROOT,
  splitRegion,
  writeMeta,
  writeSheet,
} from './sprites/lib.mjs';

const SOURCE_DIR = path.resolve(ROOT, '../imagenes/png');
const OUTPUT_DIR = path.join(ROOT, 'src/assets/drafts');

/** Alto de la pose más alta de cada tira: el del protagonista (TARGET_HEIGHT en player.mjs). */
const DRAFT_HEIGHT = 66;
/** Huecos de menos de esto (en píxeles del original) no separan poses: un mechón, una mano. */
const MIN_GAP = 6;
/**
 * Tiras que no se pueden separar solo por los huecos: los brillos de la bola
 * son puntitos sueltos, así que se agrupan en las 4 poses de la bola.
 */
const POSES = { 'brillos bola': 4 };
/** A partir de cuántos píxeles sueltos fuera de las poses se avisa. */
const STRAY_PIXELS = 200;
/** Qué parte del borde de la imagen puede no ser fondo antes de avisar (0,05 = 5 %). */
const BORDER_TOLERANCE = 0.05;

async function buildDrafts() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  const files = (await readdir(SOURCE_DIR)).filter((file) => /\.png$/i.test(file)).sort();

  const drafts = [];
  for (const file of files) {
    try {
      drafts.push(await buildDraft(file));
    } catch (error) {
      console.error(`❌ ${file}: ${error.message}`);
    }
  }
  // version cambia en cada pasada: la página la añade a la URL de las hojas
  // para que el navegador no enseñe las de antes, que tienen el mismo nombre
  await writeMeta(path.join(OUTPUT_DIR, 'drafts.json'), { version: Date.now(), drafts });
  console.log(`✔ ${drafts.length} borradores en ${rel(OUTPUT_DIR)}`);
}

async function buildDraft(file) {
  const image = await loadWithoutBackground(path.join(SOURCE_DIR, file));
  const id = file.replace(/\.png$/i, '');
  const count = POSES[id];
  const boxes = splitRegion(image, fullRegion(image), {
    axis: 'x',
    minGap: MIN_GAP,
    ...(count ? { count, extras: 'merge' } : { extras: 'drop' }),
  });
  if (boxes.length === 0) throw new Error('no se ha encontrado ningún dibujo');

  const scale = DRAFT_HEIGHT / Math.max(...boxes.map((box) => box.height));
  const sprites = await Promise.all(boxes.map((box) => extractScaled(image, box, scale)));

  // Celda a la medida de la pose más grande; todas, de pie en la misma línea
  const cell = {
    width: Math.max(...sprites.map((sprite) => sprite.width)) + 2,
    height: Math.max(...sprites.map((sprite) => sprite.height)) + 2,
  };
  const feetY = cell.height - 1;
  const layers = sprites.map((sprite, column) =>
    layer(sprite, column * cell.width + (cell.width - sprite.width) / 2, feetY - sprite.height),
  );
  const sheet = `${id.replace(/\s+/g, '-')}.png`;
  await writeSheet(path.join(OUTPUT_DIR, sheet), cell.width * sprites.length, cell.height, layers);

  const warnings = checkDrawing(image, boxes);
  console.log(
    `  ${file}: ${boxes.length} poses${warnings.length ? ` (⚠️  ${warnings.length})` : ''}`,
  );
  return {
    id,
    sheet,
    frameWidth: cell.width,
    frameHeight: cell.height,
    frames: sprites.length,
    anchor: { x: cell.width / 2, y: feetY },
    /** Alto de cada pose en el dibujo original, para ver a qué escala se dibujó. */
    sourceHeights: boxes.map((box) => box.height),
    warnings,
  };
}

/** Lo que convendría arreglar en el dibujo, en frases para enseñar en la página. */
function checkDrawing(image, boxes) {
  const warnings = [];
  const opaque = (x, y) => image.data[(y * image.width + x) * 4 + 3] > 0;

  // El borde de la imagen debería ser todo fondo
  let border = 0;
  let notBackground = 0;
  for (let x = 0; x < image.width; x++) {
    for (const y of [0, image.height - 1]) {
      border++;
      if (opaque(x, y)) notBackground++;
    }
  }
  for (let y = 0; y < image.height; y++) {
    for (const x of [0, image.width - 1]) {
      border++;
      if (opaque(x, y)) notBackground++;
    }
  }
  if (notBackground / border > BORDER_TOLERANCE) {
    const percent = Math.round((notBackground / border) * 100);
    warnings.push(
      `El fondo no es magenta puro: el ${percent} % del borde no se reconoce como fondo (usa #FF00FF liso, sin degradados).`,
    );
  }

  const inside = (x, y) =>
    boxes.some(
      (box) =>
        x >= box.left && x < box.left + box.width && y >= box.top && y < box.top + box.height,
    );
  let stray = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) if (opaque(x, y) && !inside(x, y)) stray++;
  }
  if (stray > STRAY_PIXELS) {
    warnings.push(
      `Hay ${stray} píxeles fuera de las poses (líneas de separación, motas o restos de fondo): se descartan, pero conviene borrarlos.`,
    );
  }

  boxes.forEach((box, index) => {
    const touches =
      box.left === 0 ||
      box.top === 0 ||
      box.left + box.width === image.width ||
      box.top + box.height === image.height;
    if (touches)
      warnings.push(`La pose ${index + 1} toca el borde de la imagen: puede estar cortada.`);
  });
  return warnings;
}

await buildDrafts();

if (process.argv.includes('--watch')) {
  // Al guardar, los editores escriben varias veces seguidas: se espera a que acaben
  let timer;
  watch(SOURCE_DIR, () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildDrafts().catch((error) => console.error(error)), 500);
  });
  console.log(
    `Vigilando ${path.relative(path.resolve(ROOT, '..'), SOURCE_DIR)} (Ctrl+C para salir)`,
  );
}
