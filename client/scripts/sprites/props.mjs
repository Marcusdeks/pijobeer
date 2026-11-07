/**
 * DECORADOS -> assets/sprites/truck.png (+ .json)
 *
 * Arte fuente: art/props/, sobre fondo magenta.
 *
 * El camión de reparto de lujo, aparcado en la plaza del ayuntamiento al final
 * del nivel 5. Es decorado: no choca con nada ni se anima. Va en su propia
 * hoja (y no pegado al fondo) para dibujarlo a tamaño real, tan nítido como
 * los personajes: el fondo se dibuja al doble y perdería el detalle.
 * Dónde se aparca lo decide el juego (FINALE en src/game/config.ts).
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
 * Ancho del camión en el juego: grande, como un camión de verdad al lado del
 * protagonista. Puede salirse un poco por el borde de la pantalla.
 */
const TRUCK_WIDTH = 288;

export async function buildPropSheets() {
  // Con su sombra, que oscurece el suelo de la plaza
  const file = path.join(ART_DIR, 'props', 'truck.png');
  const image = await loadWithoutBackground(file, { shadow: true });
  const box = boundingBox(image, fullRegion(image));
  const sprite = await extractScaled(image, box, TRUCK_WIDTH / box.width);

  const sheetPath = path.join(OUTPUT_DIR, 'truck.png');
  await writeSheet(sheetPath, sprite.width, sprite.height, [layer(sprite, 0, 0)]);
  await writeMeta(path.join(OUTPUT_DIR, 'truck.json'), {
    width: sprite.width,
    height: sprite.height,
  });
  console.log(`✔ ${rel(sheetPath)} (${sprite.width}x${sprite.height})`);
}
