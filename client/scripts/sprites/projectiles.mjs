/**
 * HOJAS DE PROYECTILES
 *
 *   assets/sprites/bullet-foam.png    disparo de las botellas (chorro de espuma)
 *   assets/sprites/bullet-opener.png  disparo del jugador (abrechapas en llamas)
 *
 * Cada una con su .json de metadatos. El "ancla" de cada proyectil es su
 * punto de impacto: la cabeza del chorro de espuma y el aro metálico del
 * abrechapas. El juego coloca la caja de colisión de la bala sobre ese punto.
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

export async function buildProjectileSheets() {
  await buildFoamSheet();
  await buildOpenerSheet();
}

// ------------------------------------------------------------------
//  Espuma (enemigos)
// ------------------------------------------------------------------

/**
 * El arte trae 5 chorros horizontales con la cabeza a la DERECHA:
 *   fila 1: dos chorros cortos   -> frames 0 y 1 (el chorro "nace")
 *   filas 2-4: un chorro largo   -> frames 2, 3 y 4 (en bucle mientras vuela)
 *
 * Se giran 90° en sentido horario: la cabeza queda ABAJO, que es hacia donde
 * viajan las balas enemigas, y la estela queda por encima.
 */
const FOAM = {
  file: 'foam.jpg',
  /**
   * Largo en el juego del chorro más largo (los cortos, en proporción).
   * Se escala por separado del grosor: cambiar este número acorta o alarga
   * el chorro sin hacerlo más fino ni más gordo.
   */
  length: 34,
  /** Grosor en el juego del chorro más grueso. */
  thickness: 9,
  /** Celda antes de girar (chorro tumbado, cabeza a la derecha). */
  cell: { width: 52, height: 16 },
  /** Cabeza del chorro dentro de la celda (antes de girar). */
  head: { x: 49, y: 8 },
  rotation: 90,
};

async function buildFoamSheet() {
  const image = await loadWithoutBackground(path.join(ART_DIR, 'projectiles', FOAM.file));
  const minGap = Math.round(image.width * 0.01);

  // Primero las 4 filas; después, la primera fila (los dos cortos) en 2 columnas
  const rowBoxes = splitRegion(image, fullRegion(image), { axis: 'y', count: 4, minGap });
  const [firstRow, ...longRows] = rowBoxes;
  const shortBoxes = splitRegion(image, firstRow, { axis: 'x', count: 2, minGap });
  const boxes = [...shortBoxes, ...longRows];

  // Dos escalas: una para el largo (eje X antes de girar) y otra para el grosor (eje Y)
  const lengthScale = FOAM.length / Math.max(...boxes.map((b) => b.width));
  const thicknessScale = FOAM.thickness / Math.max(...boxes.map((b) => b.height));
  const layers = [];

  for (const [i, box] of boxes.entries()) {
    // Altura de la cabeza: media de los píxeles del último 10 % del chorro (la punta)
    const tipWidth = Math.max(2, Math.round(box.width * 0.1));
    const tip = { ...box, left: box.left + box.width - tipWidth, width: tipWidth };
    const headY = centroid(image, tip).y;

    const sprite = await extractScaled(image, box, lengthScale, thicknessScale);
    const left = FOAM.head.x - sprite.width;
    const top = FOAM.head.y - (headY - box.top) * thicknessScale;

    const cell = await buildCell(
      FOAM.cell.width,
      FOAM.cell.height,
      [layer(sprite, left, top)],
      FOAM.rotation,
    );
    layers.push(layer(cell, i * cell.width, 0));
  }

  const frameWidth = FOAM.cell.height; // girado 90°: ancho y alto se intercambian
  const frameHeight = FOAM.cell.width;
  const sheetPath = path.join(OUTPUT_DIR, 'bullet-foam.png');
  await writeSheet(sheetPath, frameWidth * boxes.length, frameHeight, layers);

  await writeMeta(path.join(OUTPUT_DIR, 'bullet-foam.json'), {
    frameWidth,
    frameHeight,
    frames: boxes.length,
    // Frames que se reproducen UNA vez al salir el disparo, y los que van en bucle después
    introFrames: shortBoxes.length,
    anchor: rotatePoint(FOAM.head, FOAM.cell.width, FOAM.cell.height, FOAM.rotation),
  });

  console.log(
    `  espuma escala largo ${lengthScale.toFixed(3)}, grosor ${thicknessScale.toFixed(3)}`,
  );
  console.log(`✔ ${rel(sheetPath)} (${frameWidth * boxes.length}x${frameHeight})`);
}

// ------------------------------------------------------------------
//  Abrechapas en llamas (jugador)
// ------------------------------------------------------------------

/**
 * El arte trae 4 frames del abrechapas ardiendo, inclinado con el aro hacia
 * arriba a la derecha. Se deja tal cual (las llamas suben, que es hacia donde
 * vuela el disparo del jugador).
 *
 * Las llamas cambian mucho de forma entre frames, así que se alinean por el
 * METAL (los píxeles grises): el aro y el mango están siempre en el mismo sitio.
 */
const OPENER = {
  file: 'bottle-opener-fire.jpg',
  /** Alto en el juego del frame más alto (llamas incluidas). */
  height: 30,
  cell: { width: 28, height: 36 },
  /** Dónde queda el centro del metal dentro de cada frame. */
  anchor: { x: 15, y: 18 },
};

/** Gris metálico: los tres canales parecidos y sin ser ni negro de contorno ni blanco. */
function isMetal(r, g, b) {
  return Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 90 && r < 235;
}

async function buildOpenerSheet() {
  const image = await loadWithoutBackground(path.join(ART_DIR, 'projectiles', OPENER.file));
  const boxes = splitRegion(image, fullRegion(image), {
    axis: 'x',
    count: 4,
    // Las chispas sueltas de las llamas se unen a su frame
    minGap: Math.round(image.width * 0.01),
    extras: 'merge',
  });

  const scale = OPENER.height / Math.max(...boxes.map((b) => b.height));
  const layers = [];

  for (const [i, box] of boxes.entries()) {
    const metal = centroid(image, box, isMetal);
    const sprite = await extractScaled(image, box, scale);
    const left = OPENER.anchor.x - (metal.x - box.left) * scale;
    const top = OPENER.anchor.y - (metal.y - box.top) * scale;

    if (
      left < 0 ||
      top < 0 ||
      left + sprite.width > OPENER.cell.width ||
      top + sprite.height > OPENER.cell.height
    ) {
      console.warn(`⚠️  abrechapas/frame ${i}: se sale de la celda y se recorta`);
    }

    const cell = await buildCell(OPENER.cell.width, OPENER.cell.height, [layer(sprite, left, top)]);
    layers.push(layer(cell, i * cell.width, 0));
  }

  const sheetPath = path.join(OUTPUT_DIR, 'bullet-opener.png');
  await writeSheet(sheetPath, OPENER.cell.width * boxes.length, OPENER.cell.height, layers);

  await writeMeta(path.join(OUTPUT_DIR, 'bullet-opener.json'), {
    frameWidth: OPENER.cell.width,
    frameHeight: OPENER.cell.height,
    frames: boxes.length,
    anchor: OPENER.anchor,
  });

  console.log(`  abrechapas escala ${scale.toFixed(3)}`);
  console.log(`✔ ${rel(sheetPath)} (${OPENER.cell.width * boxes.length}x${OPENER.cell.height})`);
}
