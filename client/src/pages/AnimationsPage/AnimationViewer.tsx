/**
 * VISOR DE ANIMACIONES: reproduce en un canvas una animación del catálogo o
 * dos a la vez (lado a lado o superpuestas) para compararlas.
 *
 * Todas se apoyan en la misma línea de suelo: la de su ancla, que en los
 * personajes son los pies. Así se ve de un vistazo si un dibujo es más grande
 * que otro o si "salta" al cambiar de pose.
 *
 * El tiempo se cuenta en pasos de simulación (1/60 s), como en el juego, y se
 * guarda en una ref: el canvas se repinta en cada frame del navegador sin
 * pasar por React. Al estado de React solo va el número de frame que se ve, y
 * solo cuando cambia.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SIMULATION_STEPS_PER_SECOND } from '../../game/config';
import { loadImage } from '../../game/loadImage';
import {
  frameIndexAt,
  frameStart,
  type Hitbox,
  type SheetId,
  type SpriteAnimation,
} from '../../game/sprites/animations';
import { Button } from '../../components/ui/Button';
import minionUrl from '../../assets/sprites/barrel-minion.png';
import bossesUrl from '../../assets/sprites/bosses.png';
import cityHallUrl from '../../assets/sprites/city-hall.png';
import discoUrl from '../../assets/sprites/disco.png';
import foamUrl from '../../assets/sprites/bullet-foam.png';
import openerUrl from '../../assets/sprites/bullet-opener.png';
import bottlesUrl from '../../assets/sprites/enemy-bottles.png';
import pickupsUrl from '../../assets/sprites/pickups.png';
import pijoUrl from '../../assets/sprites/pijo.png';
import jacketUrl from '../../assets/sprites/player-jacket.png';
import playerUrl from '../../assets/sprites/player.png';
import primoUrl from '../../assets/sprites/primo.png';
import truckUrl from '../../assets/sprites/truck.png';
import styles from './AnimationsPage.module.css';

const SHEET_URLS: Record<SheetId, string> = {
  player: playerUrl,
  jacket: jacketUrl,
  bottles: bottlesUrl,
  minion: minionUrl,
  bosses: bossesUrl,
  pijo: pijoUrl,
  primo: primoUrl,
  truck: truckUrl,
  pickups: pickupsUrl,
  foam: foamUrl,
  opener: openerUrl,
  cityHall: cityHallUrl,
  disco: discoUrl,
};

export type Background = 'checker' | 'black' | 'white';

/** Cómo se ve el visor (lo elige la página). */
export interface ViewOptions {
  zoom: number;
  speed: number;
  /** Dibuja la caja de colisión. */
  hitbox: boolean;
  /** Dibuja el ancla de cada dibujo y la línea de suelo. */
  guides: boolean;
  background: Background;
  /** Con dos animaciones: una encima de la otra (la segunda, medio transparente). */
  overlay: boolean;
}

/** Margen alrededor de los dibujos y hueco entre ellos, en píxeles del juego. */
const PADDING = 12;
const GAP = 24;
const CHECKER_SIZE = 8;

export function AnimationViewer({
  animations,
  options,
}: {
  animations: readonly SpriteAnimation[];
  options: ViewOptions;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const time = useRef(0);
  const sheets = useSheets(animations);
  const [playing, setPlaying] = useState(true);
  const [shown, setShown] = useState<number[]>([]);
  const stage = useMemo(
    () => stageLayout(animations, options.overlay),
    [animations, options.overlay],
  );

  // Otra animación: vuelve a empezar desde su primer frame
  useEffect(() => {
    time.current = 0;
  }, [animations]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let last = performance.now();
    let frameId = 0;
    let shownKey = '';
    const tick = (now: number) => {
      if (playing)
        time.current += ((now - last) / 1000) * SIMULATION_STEPS_PER_SECOND * options.speed;
      last = now;
      const indices = animations.map((animation) => frameIndexAt(animation, time.current));
      drawStage(ctx, stage, animations, indices, sheets, options);
      const key = indices.join();
      if (key !== shownKey) {
        shownKey = key;
        setShown(indices);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [animations, stage, sheets, options, playing]);

  /** ‹ y ›: pausa y salta al frame anterior o siguiente de la primera animación. */
  const step = (delta: number) => {
    const main = animations[0];
    if (!main) return;
    setPlaying(false);
    const count = main.frames.length;
    const current = frameIndexAt(main, time.current);
    time.current = frameStart(main, (current + delta + count) % count);
  };

  return (
    <div className={styles.viewer}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={Math.ceil(stage.width * options.zoom)}
        height={Math.ceil(stage.height * options.zoom)}
      />
      <div className={styles.playback}>
        <Button variant="ghost" onClick={() => step(-1)} aria-label="Frame anterior">
          ‹
        </Button>
        <Button variant="ghost" onClick={() => setPlaying(!playing)}>
          {playing ? 'Pausa' : 'Reproducir'}
        </Button>
        <Button variant="ghost" onClick={() => step(1)} aria-label="Frame siguiente">
          ›
        </Button>
      </div>
      <ul className={styles.frameInfo}>
        {animations.map((animation, index) => {
          const frameIndex = shown[index] ?? 0;
          const frame = animation.frames[frameIndex];
          return (
            <li key={animation.id}>
              {animation.name}: frame {frameIndex + 1} de {animation.frames.length}
              {frame && ` · ${Math.round(frame.steps * 10) / 10} pasos`}
              {animation.notes && (
                <ul className={styles.notes}>
                  {animation.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** URL de la hoja de una animación: la del juego o la del borrador. */
const sheetUrl = ({ sheet }: SpriteAnimation) =>
  typeof sheet === 'string' ? SHEET_URLS[sheet] : sheet.url;

/** Imágenes cargadas, por URL. */
type Sheets = ReadonlyMap<string, HTMLImageElement>;

/**
 * Carga las hojas de las animaciones que se ven (loadImage las guarda en
 * caché). Mientras llegan, el visor se dibuja sin ellas.
 */
function useSheets(animations: readonly SpriteAnimation[]): Sheets {
  const [sheets, setSheets] = useState<Sheets>(new Map());
  useEffect(() => {
    let cancelled = false;
    const urls = [...new Set(animations.map(sheetUrl))];
    Promise.all(urls.map((url) => loadImage(url))).then(
      (images) => {
        if (!cancelled) setSheets(new Map(urls.map((url, index) => [url, images[index]!])));
      },
      () => {}, // Una hoja que no carga deja el visor vacío; el juego avisaría igual
    );
    return () => {
      cancelled = true;
    };
  }, [animations]);
  return sheets;
}

/** Rectángulo de la caja de colisión, con el ancla del dibujo en (0, 0). */
function hitboxRect({ width, height, anchorAt }: Hitbox) {
  const y = anchorAt === 'feet' ? -height : anchorAt === 'center' ? -height / 2 : 0;
  return { x: -width / 2, y, width, height };
}

/** Lo que ocupa una animación alrededor de su ancla (todos sus frames y su caja). */
function extent(animation: SpriteAnimation) {
  const { anchor, hitbox } = animation;
  const box = hitbox && hitboxRect(hitbox);
  const max = (values: number[]) => Math.max(0, ...values);
  const frames = animation.frames.map(({ frame }) => frame);
  return {
    left: max([anchor.x, ...(box ? [-box.x] : [])]),
    right: max([
      ...frames.map((frame) => frame.width - anchor.x),
      ...(box ? [box.x + box.width] : []),
    ]),
    up: max([anchor.y, ...(box ? [-box.y] : [])]),
    down: max([
      ...frames.map((frame) => frame.height - anchor.y),
      ...(box ? [box.y + box.height] : []),
    ]),
  };
}

interface Stage {
  width: number;
  height: number;
  /** Dónde va el ancla de cada animación, en píxeles del juego. */
  points: { x: number; y: number }[];
  groundY: number;
}

/** Coloca las animaciones: en fila (o en el mismo sitio, superpuestas) y sobre el mismo suelo. */
function stageLayout(animations: readonly SpriteAnimation[], overlay: boolean): Stage {
  const extents = animations.map(extent);
  const up = Math.max(0, ...extents.map((e) => e.up));
  const down = Math.max(0, ...extents.map((e) => e.down));
  const groundY = PADDING + up;
  if (overlay) {
    const left = Math.max(0, ...extents.map((e) => e.left));
    const right = Math.max(0, ...extents.map((e) => e.right));
    return {
      width: left + right + PADDING * 2,
      height: up + down + PADDING * 2,
      points: extents.map(() => ({ x: PADDING + left, y: groundY })),
      groundY,
    };
  }
  let cursor = PADDING;
  const points = extents.map((e) => {
    const point = { x: cursor + e.left, y: groundY };
    cursor += e.left + e.right + GAP;
    return point;
  });
  return { width: cursor - GAP + PADDING, height: up + down + PADDING * 2, points, groundY };
}

function drawStage(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  animations: readonly SpriteAnimation[],
  indices: readonly number[],
  sheets: Sheets,
  options: ViewOptions,
): void {
  ctx.setTransform(options.zoom, 0, 0, options.zoom, 0, 0);
  // Sin suavizado: el pixel art ampliado se ve nítido, como en el juego
  ctx.imageSmoothingEnabled = false;
  drawBackground(ctx, stage, options.background);

  // Las guías, en un color que se vea sobre cualquier fondo
  const guideColor = options.background === 'white' ? '#0077ff' : '#00e5ff';
  if (options.guides) {
    ctx.fillStyle = guideColor;
    ctx.fillRect(0, stage.groundY, stage.width, 1 / options.zoom);
  }

  animations.forEach((animation, index) => {
    const point = stage.points[index]!;
    const frame = animation.frames[indices[index] ?? 0]!.frame;
    const sheet = sheets.get(sheetUrl(animation));
    ctx.globalAlpha = options.overlay && index > 0 ? 0.5 : 1;
    if (sheet) {
      const { anchor } = animation;
      ctx.drawImage(
        sheet,
        frame.sx,
        frame.sy,
        frame.width,
        frame.height,
        point.x - anchor.x,
        point.y - anchor.y,
        frame.width,
        frame.height,
      );
    }
    ctx.globalAlpha = 1;
    // Líneas de 1 píxel de pantalla, se amplíe lo que se amplíe
    ctx.lineWidth = 1 / options.zoom;
    if (options.hitbox && animation.hitbox) {
      const box = hitboxRect(animation.hitbox);
      ctx.strokeStyle = '#ff2020';
      ctx.strokeRect(point.x + box.x, point.y + box.y, box.width, box.height);
    }
    if (options.guides) {
      ctx.strokeStyle = guideColor;
      ctx.beginPath();
      ctx.moveTo(point.x - 4, point.y);
      ctx.lineTo(point.x + 4, point.y);
      ctx.moveTo(point.x, point.y - 4);
      ctx.lineTo(point.x, point.y + 4);
      ctx.stroke();
    }
  });
}

function drawBackground(ctx: CanvasRenderingContext2D, stage: Stage, background: Background): void {
  if (background !== 'checker') {
    ctx.fillStyle = background === 'black' ? '#000' : '#fff';
    ctx.fillRect(0, 0, stage.width, stage.height);
    return;
  }
  // A cuadros, como en los editores de imagen: se distingue lo transparente
  for (let y = 0; y < stage.height; y += CHECKER_SIZE) {
    for (let x = 0; x < stage.width; x += CHECKER_SIZE) {
      ctx.fillStyle = ((x + y) / CHECKER_SIZE) % 2 === 0 ? '#3a3a3a' : '#2a2a2a';
      ctx.fillRect(x, y, CHECKER_SIZE, CHECKER_SIZE);
    }
  }
}
