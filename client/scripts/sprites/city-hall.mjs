/**
 * EL AYUNTAMIENTO POR DENTRO (nivel 6)
 *   -> assets/sprites/room-hall.webp, room-office.webp   las dos salas
 *   -> assets/sprites/disco.png (+ .json)                bolas de discoteca y sus brillos
 *   -> assets/sprites/city-hall.png (+ .json)            la gente: seguratas, chicas y alcalde
 *
 * Arte fuente: art/rooms/, art/props/disco-*.png y art/people/, sobre fondo magenta.
 *
 * SALAS: la planta baja (hall) y el despacho del alcalde (office). Son fijas
 * (no avanzan como los callejones), así que se escalan enteras al ancho del
 * área de juego. El juego las dibuja desde arriba: lo que pasa del alto del
 * área de juego (el borde de abajo, negro o casi) queda fuera. Las
 * coordenadas de lo que hay en ellas están en CITY_HALL (src/game/config.ts).
 *
 * BOLAS DE DISCOTECA: las bolas (4 poses girando) y sus brillos vienen en dos
 * imágenes del MISMO tamaño, dibujadas para ponerse una encima de la otra:
 * cada brillo va justo debajo de su bola. Por eso no se separan por los huecos
 * (los brillos son motas sueltas) sino en una rejilla de 4 columnas iguales,
 * recortando las dos imágenes por la misma caja: así siguen encajando.
 *   fila 0 -> la bola    fila 1 -> sus brillos
 *
 * GENTE: una fila por animación (ver PEOPLE), todas en celdas del mismo
 * tamaño y apoyadas por los pies en el centro de la base, como el jugador.
 * Debajo de todas, las mismas filas en blanco para el destello de los impactos.
 */
import path from 'node:path';
import sharp from 'sharp';
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
import { whiteSilhouette } from './bosses.mjs';

/** Ancho al que se escalan las salas: el del área de juego (ARENA.width). */
const ROOM_WIDTH = 800;
const ROOMS = ['hall', 'office'];

/** Bolas de discoteca: columnas de la rejilla y ancho de la bola en el juego. */
const DISCO = { columns: 4, ballWidth: 60 };

/**
 * Alto de pie en el juego: los seguratas, como el protagonista (66); las
 * chicas de la fiesta, algo más bajas; las del despacho, que son jefas, algo
 * más grandes para que se las vea bien; el alcalde, un grandullón.
 */
const HEIGHT = { guard: 66, girl: 62, officeGirl: 70, mayor: 86 };

/**
 * Animaciones de la gente, en el orden de las filas de la hoja.
 *
 *   id        nombre de la fila (el juego la busca por él en city-hall.json)
 *   file      tira de art/people/
 *   standing  alto, en el dibujo, de una pose de pie de la tira. Cada tira
 *             está dibujada a una escala distinta (bailando, asustada y
 *             corriendo no miden lo mismo), así que la escala sale de aquí:
 *             la pose de pie mide en el juego lo que diga `height`. Así el
 *             mismo personaje no cambia de tamaño de una animación a otra.
 *   height    alto de pie en el juego (ver HEIGHT)
 *   top       filas de arriba que se ignoran (la tira del segurata 1 trae una raya)
 *
 * La chica 5 sale dos veces: bailando en la fiesta (a su tamaño) y como jefa
 * en el despacho (más grande). Son la misma tira escalada a dos tamaños.
 */
const PEOPLE = [
  { id: 'guard-1', file: 'guard-1.png', standing: 470, height: HEIGHT.guard, top: 6 },
  { id: 'guard-2', file: 'guard-2.png', standing: 227, height: HEIGHT.guard },
  { id: 'guard-3', file: 'guard-3.png', standing: 474, height: HEIGHT.guard },
  { id: 'guard-4', file: 'guard-4.png', standing: 457, height: HEIGHT.guard },
  { id: 'girl-3-dance', file: 'girl-3-dance.png', standing: 470, height: HEIGHT.girl },
  { id: 'girl-3-scared', file: 'girl-3-scared.png', standing: 544, height: HEIGHT.girl },
  { id: 'girl-3-run', file: 'girl-3-run.png', standing: 500, height: HEIGHT.girl },
  { id: 'girl-5-dance', file: 'girl-5-dance.png', standing: 475, height: HEIGHT.girl },
  { id: 'girl-5-scared', file: 'girl-5-scared.png', standing: 539, height: HEIGHT.girl },
  { id: 'girl-7-dance', file: 'girl-7-dance.png', standing: 472, height: HEIGHT.girl },
  { id: 'girl-7-scared', file: 'girl-7-scared.png', standing: 585, height: HEIGHT.girl },
  { id: 'girl-7-run', file: 'girl-7-run.png', standing: 520, height: HEIGHT.girl },
  { id: 'office-girl-1', file: 'girl-1-dance.png', standing: 495, height: HEIGHT.officeGirl },
  { id: 'office-girl-5', file: 'girl-5-dance.png', standing: 475, height: HEIGHT.officeGirl },
  { id: 'mayor', file: 'mayor.png', standing: 942, height: HEIGHT.mayor },
];

export async function buildCityHallSheets() {
  await buildRooms();
  await buildDisco();
  await buildPeople();
}

// ------------------------------------------------------------------

async function buildRooms() {
  for (const room of ROOMS) {
    const file = path.join(OUTPUT_DIR, `room-${room}.webp`);
    // WebP sin pérdida, como los callejones
    const { width, height } = await sharp(path.join(ART_DIR, 'rooms', `${room}.png`))
      .resize({ width: ROOM_WIDTH, kernel: 'lanczos3' })
      .webp({ lossless: true, effort: 6 })
      .toFile(file);
    console.log(`✔ ${rel(file)} (${width}x${height})`);
  }
}

async function buildDisco() {
  const [balls, sparkles] = await Promise.all(
    ['disco-balls.png', 'disco-sparkles.png'].map((file) =>
      loadWithoutBackground(path.join(ART_DIR, 'props', file)),
    ),
  );
  const columnWidth = balls.width / DISCO.columns;
  const column = (index) => ({
    left: Math.round(index * columnWidth),
    top: 0,
    width: Math.round(columnWidth),
    height: balls.height,
  });

  // La caja que cubre bola y brillos en todas las columnas, medida desde el
  // borde de cada columna: la misma para todos los recortes
  const boxes = [balls, sparkles].flatMap((image) =>
    Array.from({ length: DISCO.columns }, (_, index) => {
      const box = boundingBox(image, column(index));
      return box && { ...box, left: box.left - column(index).left };
    }).filter(Boolean),
  );
  const left = Math.min(...boxes.map((box) => box.left));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  // Desde arriba del todo: la cadena tiene que llegar al techo (al borde de la pantalla)
  const crop = { left, top: 0, width: right - left, height: bottom };
  const ballBox = boundingBox(balls, column(0));
  const scale = DISCO.ballWidth / ballBox.width;

  const layers = [];
  let cell = null;
  for (const [row, image] of [balls, sparkles].entries()) {
    for (let index = 0; index < DISCO.columns; index++) {
      const box = { ...crop, left: column(index).left + crop.left };
      const sprite = await extractScaled(image, box, scale);
      cell ??= { width: sprite.width, height: sprite.height };
      layers.push(layer(sprite, index * cell.width, row * cell.height));
    }
  }

  const sheetPath = path.join(OUTPUT_DIR, 'disco.png');
  await writeSheet(sheetPath, cell.width * DISCO.columns, cell.height * 2, layers);
  await writeMeta(path.join(OUTPUT_DIR, 'disco.json'), {
    frameWidth: cell.width,
    frameHeight: cell.height,
    frames: DISCO.columns,
    // Donde nace la cadena: arriba, en el centro de la bola
    anchor: {
      x: Math.round((ballBox.left + ballBox.width / 2 - crop.left) * scale),
      y: 0,
    },
  });
  console.log(`✔ ${rel(sheetPath)} (${cell.width * DISCO.columns}x${cell.height * 2})`);
}

async function buildPeople() {
  const rows = [];
  for (const person of PEOPLE) {
    const image = await loadWithoutBackground(path.join(ART_DIR, 'people', person.file));
    const top = person.top ?? 0;
    const region = { ...fullRegion(image), top, height: image.height - top };
    // Sin `count`: cada tira trae las poses que trae (3 o 4); las motas se descartan
    const boxes = splitRegion(image, region, { axis: 'x', minGap: 6, extras: 'drop' });
    const scale = person.height / person.standing;
    const sprites = await Promise.all(boxes.map((box) => extractScaled(image, box, scale)));
    rows.push({ id: person.id, sprites });
    console.log(
      `  ${person.id.padEnd(14)} ${sprites.map((s) => `${s.width}x${s.height}`).join(' ')}`,
    );
  }

  // Celdas a la medida de la pose más grande (en par, para centrar sin decimales)
  const sprites = rows.flatMap((row) => row.sprites);
  const even = (value) => Math.ceil(value / 2) * 2;
  const cell = {
    width: even(Math.max(...sprites.map((sprite) => sprite.width)) + 2),
    height: even(Math.max(...sprites.map((sprite) => sprite.height)) + 2),
  };
  const feetY = cell.height - 1;
  const columns = Math.max(...rows.map((row) => row.sprites.length));

  const layers = [];
  for (const [rowIndex, row] of rows.entries()) {
    for (const [column, sprite] of row.sprites.entries()) {
      const left = column * cell.width + (cell.width - sprite.width) / 2;
      const top = rowIndex * cell.height + feetY - sprite.height;
      const flashTop = top + rows.length * cell.height;
      layers.push(layer(sprite, left, top), layer(whiteSilhouette(sprite), left, flashTop));
    }
  }

  const sheetPath = path.join(OUTPUT_DIR, 'city-hall.png');
  const width = cell.width * columns;
  const height = cell.height * rows.length * 2;
  await writeSheet(sheetPath, width, height, layers);
  await writeMeta(path.join(OUTPUT_DIR, 'city-hall.json'), {
    frameWidth: cell.width,
    frameHeight: cell.height,
    /** Filas de dibujos normales (las del destello van debajo, en el mismo orden). */
    rows: rows.length,
    /** Fila de cada animación y cuántas poses tiene. */
    animations: Object.fromEntries(
      rows.map((row, index) => [row.id, { row: index, frames: row.sprites.length }]),
    ),
    // Los pies, centrados: se hacen coincidir con la base de la caja de colisión
    anchor: { x: cell.width / 2, y: feetY },
  });
  console.log(`✔ ${rel(sheetPath)} (${width}x${height})`);
}
