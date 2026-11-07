/**
 * BORRADORES (temporal): las tiras de imagenes/png/ preparadas por
 * "npm run sprites:drafts" (scripts/build-drafts.mjs), como animaciones del
 * catálogo para revisarlas antes de meterlas en el juego.
 *
 * Se leen con import.meta.glob: si la carpeta src/assets/drafts/ no existe
 * (no se ha ejecutado el script, o se ha borrado), simplemente no hay
 * borradores. Al volver a generarlos, Vite recarga este módulo solo.
 */
import type { SpriteAnimation } from '../../game/sprites/animations';

interface DraftsFile {
  version: number;
  drafts: {
    id: string;
    sheet: string;
    frameWidth: number;
    frameHeight: number;
    frames: number;
    anchor: { x: number; y: number };
    sourceHeights: number[];
    warnings: string[];
  }[];
}

/** Pasos que dura cada pose (0,2 s): se cambia con la velocidad del visor. */
const STEPS_PER_POSE = 12;

const manifests = import.meta.glob<DraftsFile>('../../assets/drafts/drafts.json', {
  eager: true,
  import: 'default',
});
const sheetUrls = import.meta.glob<string>('../../assets/drafts/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const manifest = Object.values(manifests)[0];

export const DRAFT_ANIMATIONS: SpriteAnimation[] = (manifest?.drafts ?? []).flatMap((draft) => {
  const url = sheetUrls[`../../assets/drafts/${draft.sheet}`];
  if (!url) return [];
  return {
    id: `draft-${draft.id}`,
    name: `Borrador · ${draft.id}`,
    // La versión en la URL obliga a descargar la hoja nueva tras regenerarla
    sheet: { url: `${url}?version=${manifest!.version}` },
    anchor: draft.anchor,
    hitbox: null,
    frames: Array.from({ length: draft.frames }, (_, column) => ({
      frame: {
        sx: column * draft.frameWidth,
        sy: 0,
        width: draft.frameWidth,
        height: draft.frameHeight,
      },
      steps: STEPS_PER_POSE,
    })),
    notes: [
      ...draft.warnings.map((warning) => `⚠️ ${warning}`),
      `Alto de cada pose en el dibujo original: ${draft.sourceHeights.join(', ')} px.`,
    ],
  };
});
