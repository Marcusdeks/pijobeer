/**
 * HERRAMIENTAS COMUNES para generar hojas de sprites a partir del arte fuente.
 *
 * Todo el arte fuente (client/art/) llega igual: dibujos sobre fondo magenta,
 * en JPEG o PNG, a tamaños y escalas distintos. Estas funciones lo convierten
 * en frames limpios y alineados. Cada hoja concreta (jugador, enemigos,
 * balas) está en su propio módulo y solo decide QUÉ recortar y DÓNDE ponerlo.
 *
 * Una "imagen" en estas funciones es { data, width, height }: los píxeles
 * en RGBA crudo (4 bytes por píxel), que es lo más cómodo para analizarlos.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** Carpeta client/ (la raíz para el resto de rutas). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ART_DIR = path.join(ROOT, 'art');
export const OUTPUT_DIR = path.join(ROOT, 'src/assets/sprites');

// ------------------------------------------------------------------
//  Carga y fondo
// ------------------------------------------------------------------

/**
 * ¿Es este píxel fondo? El magenta puro es (255, 0, 255), pero las imágenes
 * vienen en JPEG y el fondo tiene "ruido" de compresión: no hay dos píxeles
 * iguales. Por eso no se compara contra un color exacto, sino contra la idea
 * de "rojo y azul muy por encima del verde", que solo cumple el magenta.
 */
function isBackground(r, g, b) {
  return r > 150 && b > 150 && r - g > 90 && b - g > 90;
}

/** Carga una imagen y sustituye el fondo magenta por transparencia. */
export async function loadWithoutBackground(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (isBackground(r, g, b)) {
      data[i + 3] = 0;
    } else if (r - g > 40 && b - g > 40) {
      // "Despill": los bordes del dibujo se mezclan con el fondo y quedan
      // rosados. Les bajamos el rojo y el azul al nivel del verde para quitar ese halo.
      const limit = g + 40;
      data[i] = Math.min(r, limit);
      data[i + 2] = Math.min(b, limit);
    }
  }

  return { data, width: info.width, height: info.height };
}

/** ¿Tiene contenido visible el píxel (x, y)? */
function isOpaque(image, x, y) {
  return image.data[(y * image.width + x) * 4 + 3] > 0;
}

/** La imagen entera como región. */
export function fullRegion(image) {
  return { left: 0, top: 0, width: image.width, height: image.height };
}

// ------------------------------------------------------------------
//  Localizar frames
// ------------------------------------------------------------------

/**
 * Caja ajustada a los píxeles visibles dentro de una región.
 * @returns {{left, top, width, height} | null} null si la región está vacía
 */
export function boundingBox(image, region) {
  let top = Infinity;
  let bottom = -1;
  let left = Infinity;
  let right = -1;

  for (let y = region.top; y < region.top + region.height; y++) {
    for (let x = region.left; x < region.left + region.width; x++) {
      if (isOpaque(image, x, y)) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  return bottom < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Divide una región en `count` trozos a lo largo de un eje, usando los huecos
 * vacíos entre dibujos.
 *
 * Cómo funciona: cuenta los píxeles visibles de cada columna (eje 'x') o de
 * cada fila (eje 'y'). Donde la cuenta es cero hay fondo; los tramos con
 * contenido separados por huecos de al menos `minGap` píxeles son grupos.
 *
 * Casi nunca salen exactamente `count` grupos: el JPEG deja motas sueltas, y
 * los dibujos tienen trozos separados (gotas de espuma, chispas, la chapa que
 * sale volando). Qué hacer con los grupos de más lo decide `extras`:
 *   - 'drop'  -> se descartan los más estrechos (ruido). Para dibujos compactos.
 *   - 'merge' -> el más estrecho se une a su vecino más cercano, hasta quedar
 *                `count`. Así las gotas y chispas se quedan con su frame.
 *
 * @returns {Array<{left, top, width, height}>} cajas ajustadas, en orden
 */
export function splitRegion(image, region, { axis, count, minGap = 1, extras = 'merge' }) {
  const along = axis === 'x' ? region.width : region.height;
  const across = axis === 'x' ? region.height : region.width;
  const minPixels = 3; // menos que esto en una columna/fila es ruido del JPEG

  const hasContent = [];
  for (let i = 0; i < along; i++) {
    let pixels = 0;
    for (let j = 0; j < across; j++) {
      const x = region.left + (axis === 'x' ? i : j);
      const y = region.top + (axis === 'x' ? j : i);
      if (isOpaque(image, x, y)) pixels++;
    }
    hasContent.push(pixels >= minPixels);
  }

  // Tramos con contenido, uniendo los que están separados por menos de minGap
  let groups = [];
  for (let i = 0; i < along; i++) {
    if (!hasContent[i]) continue;
    const last = groups.at(-1);
    if (last && i - last.to <= minGap) last.to = i;
    else groups.push({ from: i, to: i });
  }

  const size = (g) => g.to - g.from;

  if (extras === 'drop') {
    groups = groups
      .filter((g) => size(g) > 20)
      .sort((a, b) => size(b) - size(a))
      .slice(0, count)
      .sort((a, b) => a.from - b.from);
  } else {
    while (groups.length > count) {
      const i = groups.reduce((best, g, k) => (size(g) < size(groups[best]) ? k : best), 0);
      const prev = groups[i - 1];
      const next = groups[i + 1];
      const gapPrev = prev ? groups[i].from - prev.to : Infinity;
      const gapNext = next ? next.from - groups[i].to : Infinity;
      const neighbor = gapPrev <= gapNext ? i - 1 : i + 1;
      const [a, b] = [Math.min(i, neighbor), Math.max(i, neighbor)];
      groups.splice(a, 2, { from: groups[a].from, to: groups[b].to });
    }
  }

  if (groups.length !== count) {
    throw new Error(`Se esperaban ${count} frames y se han encontrado ${groups.length}`);
  }

  return groups.map((g) => {
    const slice =
      axis === 'x'
        ? { left: region.left + g.from, top: region.top, width: size(g) + 1, height: region.height }
        : { left: region.left, top: region.top + g.from, width: region.width, height: size(g) + 1 };
    return boundingBox(image, slice);
  });
}

/**
 * Centro (media) de los píxeles visibles de una caja que cumplen `filter`.
 * Sirve para alinear frames por una parte concreta del dibujo (la base de la
 * botella, la cabeza del abrechapas...) en vez de por su caja, que cambia
 * de forma de un frame a otro (espuma, llamas).
 */
export function centroid(image, box, filter = () => true) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = box.top; y < box.top + box.height; y++) {
    for (let x = box.left; x < box.left + box.width; x++) {
      const i = (y * image.width + x) * 4;
      if (
        image.data[i + 3] > 0 &&
        filter(image.data[i], image.data[i + 1], image.data[i + 2], x, y)
      ) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  if (n === 0) throw new Error('centroid: no hay píxeles que cumplan el filtro');
  return { x: sx / n, y: sy / n };
}

// ------------------------------------------------------------------
//  Escalar y componer
// ------------------------------------------------------------------

/**
 * Recorta una caja de la imagen y la escala por `scale`.
 *
 * Con `scaleY` se puede escalar el alto distinto del ancho (p. ej. acortar
 * un chorro de espuma sin hacerlo más fino). Si no se pasa, la escala es
 * uniforme y el dibujo conserva sus proporciones.
 *
 * @returns {{data, width, height}} píxeles RGBA con la transparencia binarizada
 */
export async function extractScaled(image, box, scale, scaleY = scale) {
  const width = Math.max(1, Math.round(box.width * scale));
  const height = Math.max(1, Math.round(box.height * scaleY));

  const { data, info } = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .extract(box)
    // "lanczos3" reduce con buena nitidez; sharp tiene en cuenta la transparencia
    // al mezclar, así que los bordes no se oscurecen.
    .resize(width, height, { kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Pixel art: un píxel es visible o no lo es. Los semitransparentes del
  // escalado se redondean para que el dibujo tenga bordes limpios.
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 128 ? 255 : 0;

  return { data, width: info.width, height: info.height };
}

/** Capa para sharp.composite() a partir de un sprite en RGBA crudo. */
export function layer(sprite, left, top) {
  return {
    input: sprite.data,
    raw: { width: sprite.width, height: sprite.height, channels: 4 },
    left: Math.round(left),
    top: Math.round(top),
  };
}

/** Lienzo transparente de un tamaño dado. */
function blank(width, height) {
  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
}

/**
 * Compone un frame (una celda de la hoja) a partir de capas y, si hace falta,
 * lo gira. Girar la celda entera (y no el dibujo suelto) hace que el punto de
 * anclaje se transforme de forma predecible (ver rotatePoint).
 *
 * @param {0|90|180|270} rotate - grados en sentido horario
 */
export async function buildCell(width, height, layers, rotate = 0) {
  const flat = await blank(width, height).composite(layers).png().toBuffer();
  const pipeline = rotate ? sharp(flat).rotate(rotate) : sharp(flat);
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Dónde acaba un punto (x, y) de una celda de width x height tras girarla.
 * Necesario para saber dónde queda el ancla (pies, base de la botella...) en
 * la celda girada.
 */
export function rotatePoint({ x, y }, width, height, rotate) {
  switch (rotate) {
    case 90:
      return { x: height - y, y: x };
    case 180:
      return { x: width - x, y: height - y };
    case 270:
      return { x: y, y: width - x };
    default:
      return { x, y };
  }
}

/** Guarda una hoja de sprites compuesta de capas. */
export async function writeSheet(file, width, height, layers) {
  await mkdir(path.dirname(file), { recursive: true });
  await blank(width, height).composite(layers).png({ compressionLevel: 9 }).toFile(file);
}

/** Guarda los metadatos de una hoja generada, con aviso de no editarlos a mano. */
export async function writeMeta(file, meta) {
  const content = {
    _generado: 'Archivo generado por "npm run sprites". No lo edites a mano: cambia el script.',
    ...meta,
  };
  await writeFile(file, `${JSON.stringify(content, null, 2)}\n`);
}

/** Ruta relativa a client/, para los mensajes por consola. */
export function rel(file) {
  return path.relative(ROOT, file);
}
