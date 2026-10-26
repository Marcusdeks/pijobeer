/**
 * HOJA DEL JUGADOR (8 direcciones x ciclo de andar) -> assets/sprites/player.png
 *
 * Arte fuente: art/player/, una imagen por dirección con 3 poses (neutro y
 * dos pasos) sobre fondo magenta. Tamaños, filas y pivote salen de
 * assets/sprites/player.json, que es la ÚNICA fuente de verdad (lo usa también el juego).
 *
 * Pasos para cada dirección:
 *   1. Localizar las 3 poses.
 *   2. Escalarlas con el mismo factor, para que el neutro mida TARGET_HEIGHT.
 *   3. Colocar cada pose en su frame de 64x80 con la base de los pies en el pivote.
 *   4. Componer la fila: [neutro, paso 1, neutro, paso 2].
 *
 * Además, la pose de la CHUPA (art/player/jacket.jpg: de espaldas, abriéndola
 * para protegerse) va en su propia imagen, assets/sprites/player-jacket.png:
 * un solo frame del mismo tamaño y con el mismo pivote que los de la hoja,
 * así el juego la coloca exactamente igual que cualquier otra pose.
 */
import { readFile } from 'node:fs/promises';
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
  writeSheet,
} from './lib.mjs';

const META_PATH = path.join(OUTPUT_DIR, 'player.json');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'player.png');
const JACKET_OUTPUT_PATH = path.join(OUTPUT_DIR, 'player-jacket.png');

/**
 * Arte fuente de cada dirección (clave = nombre de fila en player.json).
 *
 * `neutral` indica en qué posición (0, 1 o 2, de izquierda a derecha) está la
 * pose neutra dentro de la imagen: no todas las imágenes vienen en el mismo
 * orden. Las otras dos se toman como paso 1 y paso 2, en el orden en que aparecen.
 *
 * Nota: la dirección es la de la PANTALLA. "down-right" es el personaje
 * mirando hacia abajo a la derecha del monitor.
 */
const SOURCES = {
  arriba: { file: 'up.jpg', neutral: 0 },
  arriba_derecha: { file: 'up-right.png', neutral: 0 },
  derecha: { file: 'right.jpg', neutral: 0 },
  abajo_derecha: { file: 'down-right.jpg', neutral: 0 },
  abajo: { file: 'down.jpg', neutral: 0 },
  abajo_izquierda: { file: 'down-left.png', neutral: 0 },
  izquierda: { file: 'left.png', neutral: 2 },
  arriba_izquierda: { file: 'up-left.png', neutral: 0 },
};

/**
 * Altura en píxeles que ocupa el personaje en pose neutra dentro del frame.
 * Con los pies en y=69, la cabeza queda en y=69-66=3: margen de 3 px arriba.
 */
const TARGET_HEIGHT = 66;

/**
 * Lo máximo (en píxeles) que puede bajar la cabeza en una pose de paso
 * respecto a la neutra. Sube el valor para más balanceo al andar; bájalo
 * para que el personaje vaya más "plano".
 */
const MAX_HEAD_DROP = 3;

export async function buildPlayerSheet() {
  const meta = JSON.parse(await readFile(META_PATH, 'utf8'));
  const { frame_width: frameW, frame_height: frameH, columns, rows, pivot_pies: pivot } = meta;

  // Qué pose fuente va en cada columna, a partir de frame_order de player.json
  const poseForFrame = { neutro: 'neutral', paso_1: 'step1', paso_2: 'step2' };
  const columnPoses = meta.frame_order.map((name) => {
    if (!(name in poseForFrame)) throw new Error(`frame_order: valor desconocido "${name}"`);
    return poseForFrame[name];
  });

  const layers = [];

  for (const [direction, row] of Object.entries(meta.filas)) {
    const source = SOURCES[direction];
    if (!source) throw new Error(`Falta el arte fuente de la dirección "${direction}"`);

    const image = await loadWithoutBackground(path.join(ART_DIR, 'player', source.file));
    // Poses compactas: lo que sobre son motas de ruido y se descarta
    const boxes = splitRegion(image, fullRegion(image), { axis: 'x', count: 3, extras: 'drop' });

    const neutral = boxes[source.neutral];
    const [step1, step2] = boxes.filter((_, i) => i !== source.neutral);
    const byPose = { neutral, step1, step2 };

    // Mismo factor para las 3 poses de una dirección: así se conserva el
    // "rebote" natural de la animación en vez de estirar cada pose por separado.
    const scale = TARGET_HEIGHT / neutral.height;

    const extracted = {};
    for (const [pose, box] of Object.entries(byPose)) {
      // Con los pies siempre en el pivote, una pose más baja que la neutra
      // (zancada abierta) hace que la cabeza "baje" en pantalla: ese es el
      // balanceo natural al andar. Si baja más de MAX_HEAD_DROP se nota como
      // un salto, así que esa pose se amplía lo justo para que baje solo
      // MAX_HEAD_DROP. El resto de poses conservan el factor común.
      const minHeight = TARGET_HEIGHT - MAX_HEAD_DROP;
      const poseScale = Math.max(scale, minHeight / box.height);
      extracted[pose] = await extractScaled(image, box, poseScale);
    }

    columnPoses.forEach((pose, column) => {
      const sprite = extracted[pose];
      if (sprite.width > frameW || sprite.height > pivot.y + 1) {
        console.warn(`⚠️  ${direction}/${pose}: ${sprite.width}x${sprite.height} no cabe entero`);
      }
      // Base de los pies sobre el pivote y centrado horizontal en él
      layers.push(
        layer(
          sprite,
          column * frameW + pivot.x - sprite.width / 2,
          row * frameH + pivot.y - sprite.height + 1,
        ),
      );
    });

    console.log(
      `  ${direction.padEnd(16)} escala ${scale.toFixed(3)}  ` +
        Object.entries(extracted)
          .map(([pose, s]) => `${pose} ${s.width}x${s.height}`)
          .join(', '),
    );
  }

  await writeSheet(OUTPUT_PATH, frameW * columns, frameH * rows, layers);
  console.log(`✔ ${rel(OUTPUT_PATH)} (${frameW * columns}x${frameH * rows})`);

  await buildJacketFrame(meta);
}

/** La pose de la chupa: misma altura que el neutro y los pies sobre el pivote. */
async function buildJacketFrame({ frame_width: frameW, frame_height: frameH, pivot_pies: pivot }) {
  const image = await loadWithoutBackground(path.join(ART_DIR, 'player', 'jacket.jpg'));
  const box = boundingBox(image, fullRegion(image));
  const sprite = await extractScaled(image, box, TARGET_HEIGHT / box.height);
  if (sprite.width > frameW) console.warn(`⚠️  chupa: ${sprite.width} px de ancho no cabe entera`);

  await writeSheet(JACKET_OUTPUT_PATH, frameW, frameH, [
    layer(sprite, pivot.x - sprite.width / 2, pivot.y - sprite.height + 1),
  ]);
  console.log(
    `✔ ${rel(JACKET_OUTPUT_PATH)} (${frameW}x${frameH}, chupa ${sprite.width}x${sprite.height})`,
  );
}
