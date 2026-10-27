/**
 * FONDOS DE LOS CALLEJONES -> assets/sprites/alley-N.webp + assets/sprites/alleys.json
 *
 * Arte fuente: art/alleys/alley-N.png. Cada imagen trae 3 tiras verticales
 * del mismo callejón visto desde arriba, separadas por un marco negro.
 *
 * Las 3 tiras se ponen una debajo de otra y forman un callejón largo que el
 * juego desplaza hacia abajo y repite en bucle. Las uniones entre tiras (y la
 * del final con el principio, para que el bucle sea continuo) se funden con
 * un degradado de BLEND_ROWS filas.
 *
 * El callejón se dibuja ENTERO, paredes incluidas, en una sola capa. Un
 * parallax de verdad (paredes más rápidas que el suelo) necesitaría el arte
 * de las paredes en una imagen aparte con el centro transparente: recortarlas
 * de estas tiras opacas queda falso.
 *
 * Aun así, el script mide dónde están las paredes (wallLeft / wallRight) para
 * calcular la zona jugable: nadie puede meterse en ellas.
 */
import path from 'node:path';
import sharp from 'sharp';
import { ART_DIR, OUTPUT_DIR, rel, writeMeta } from './lib.mjs';

/**
 * Callejones. `wallLeft` y `wallRight` marcan, en tanto por uno del ancho de
 * una tira, dónde acaba la pared izquierda y dónde empieza la derecha
 * (ladrillo + tubería). Medidos sobre el arte; si se sustituye una imagen,
 * hay que revisarlos.
 */
const ALLEYS = [
  { id: 1, file: 'alley-1.png', wallLeft: 0.14, wallRight: 0.875 },
  { id: 2, file: 'alley-2.png', wallLeft: 0.155, wallRight: 0.86 },
  { id: 3, file: 'alley-3.png', wallLeft: 0.145, wallRight: 0.885 },
  // Nivel 4: calle de ciudad (ya fuera del polígono), con aceras y fachadas a los lados
  { id: 4, file: 'alley-4.png', wallLeft: 0.15, wallRight: 0.84 },
];

/**
 * Ancho de las hojas generadas. El juego las dibuja al DOBLE (800 px, el ancho
 * del área de juego) con escalado "pixelated": así pesan la cuarta parte que a
 * tamaño real y se ven igual de nítidas, porque el arte ya es pixel art.
 */
const SHEET_WIDTH = 400;
const DRAW_SCALE = 2;

/** Filas de fundido entre una tira y la siguiente. */
const BLEND_ROWS = 24;

/** Margen (px del juego) entre la pared y el borde jugable, para que nadie "roce" el ladrillo. */
const FLOOR_MARGIN = 4;

export async function buildAlleySheets() {
  const meta = { drawScale: DRAW_SCALE, alleys: {} };

  for (const alley of ALLEYS) {
    const file = path.join(ART_DIR, 'alleys', alley.file);
    const strips = await findStrips(file);
    const resized = await Promise.all(strips.map((box) => loadStrip(file, box)));
    const floor = stackLooping(resized);

    const wallLeftPx = Math.round(SHEET_WIDTH * alley.wallLeft);
    const wallRightPx = Math.round(SHEET_WIDTH * alley.wallRight);

    const sheetPath = path.join(OUTPUT_DIR, `alley-${alley.id}.webp`);
    // WebP sin pérdida: los mismos píxeles que un PNG, en bastante menos espacio
    await toWebp(floor, sheetPath);

    meta.alleys[alley.id] = {
      height: floor.height,
      // Zona por la que se puede mover todo, en píxeles del área de juego
      floorLeft: wallLeftPx * DRAW_SCALE + FLOOR_MARGIN,
      floorRight: wallRightPx * DRAW_SCALE - FLOOR_MARGIN,
    };

    console.log(
      `✔ ${rel(sheetPath)} (${SHEET_WIDTH}x${floor.height}, ` +
        `suelo jugable ${meta.alleys[alley.id].floorLeft}-${meta.alleys[alley.id].floorRight})`,
    );
  }

  await writeMeta(path.join(OUTPUT_DIR, 'alleys.json'), meta);
}

// ------------------------------------------------------------------

/**
 * Localiza las tiras: los separadores son columnas (y filas) casi enteramente
 * negras. Lo que queda entre separadores son las tiras. Los rótulos que
 * pueda haber debajo ("CAPA 1 - ...") quedan fuera porque solo se coge el
 * tramo vertical más alto de cada tira.
 */
async function findStrips(file) {
  // Lo transparente (márgenes que traen algunas imágenes) se pinta de negro:
  // así cuenta como marco y no se cuela en la primera o la última tira
  const { data, info } = await sharp(file)
    .flatten({ background: '#000000' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const isBlack = (x, y) => {
    const k = (y * W + x) * C;
    return data[k] < 10 && data[k + 1] < 10 && data[k + 2] < 10;
  };

  /** Tramos (sin separador) a lo largo de un eje, ignorando los de menos de 50 px. */
  const runs = (length, isSeparator) => {
    const result = [];
    let start = -1;
    for (let i = 0; i <= length; i++) {
      const content = i < length && !isSeparator(i);
      if (content && start < 0) start = i;
      if (!content && start >= 0) {
        if (i - start > 50) result.push({ from: start, size: i - start });
        start = -1;
      }
    }
    return result;
  };

  const columnIsSeparator = (x) => {
    let black = 0;
    for (let y = 0; y < H; y += 2) if (isBlack(x, y)) black++;
    return black > (H / 2) * 0.97;
  };

  const strips = runs(W, columnIsSeparator).map(({ from: left, size: width }) => {
    const rowIsSeparator = (y) => {
      let black = 0;
      for (let x = left; x < left + width; x++) if (isBlack(x, y)) black++;
      return black > width * 0.97;
    };
    const rows = runs(H, rowIsSeparator).sort((a, b) => b.size - a.size);
    return { left, top: rows[0].from, width, height: rows[0].size };
  });

  if (strips.length !== 3) {
    throw new Error(`${path.basename(file)}: se esperaban 3 tiras y hay ${strips.length}`);
  }
  return strips;
}

/** Recorta una tira y la escala al ancho de la hoja. Devuelve píxeles RGBA crudos. */
async function loadStrip(file, box) {
  const { data, info } = await sharp(file)
    .extract(box)
    .resize({ width: SHEET_WIDTH, kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Apila las tiras en vertical fundiendo cada unión, y deja el final de la
 * imagen encadenado con el principio para que se pueda repetir sin corte.
 *
 *   - Cada tira (salvo la primera) empieza BLEND_ROWS filas antes de que
 *     acabe la anterior, con un degradado de transparente a opaco.
 *   - Las últimas BLEND_ROWS filas de la última tira se mueven al PRINCIPIO,
 *     fundiéndose con el comienzo de la primera. Así, al terminar la imagen
 *     y volver a empezar, el dibujo continúa sin salto.
 */
function stackLooping(strips) {
  const width = strips[0].width;
  const height = strips.reduce((sum, s) => sum + s.height, 0) - strips.length * BLEND_ROWS;
  const out = Buffer.alloc(width * height * 4);

  /** Copia la fila `srcRow` de `strip` a la fila `dstRow`, mezclando con `alpha` (0-1). */
  const blendRow = (strip, srcRow, dstRow, alpha) => {
    for (let x = 0; x < width; x++) {
      const s = (srcRow * strip.width + x) * 4;
      const d = (dstRow * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        out[d + c] = Math.round(out[d + c] * (1 - alpha) + strip.data[s + c] * alpha);
      }
      out[d + 3] = 255;
    }
  };

  let y = 0;
  strips.forEach((strip, index) => {
    const usable = index === strips.length - 1 ? strip.height - BLEND_ROWS : strip.height;
    for (let row = 0; row < usable; row++) {
      const fading = index > 0 && row < BLEND_ROWS;
      blendRow(strip, row, y + row, fading ? (row + 1) / (BLEND_ROWS + 1) : 1);
    }
    y += strip.height - BLEND_ROWS;
  });

  // Unión del final con el principio: el final de la última tira se funde sobre el arranque de la primera
  const last = strips.at(-1);
  for (let row = 0; row < BLEND_ROWS; row++) {
    blendRow(last, last.height - BLEND_ROWS + row, row, 1 - (row + 1) / (BLEND_ROWS + 1));
  }

  return { data: out, width, height };
}

function toWebp(image, file) {
  return sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(file);
}
