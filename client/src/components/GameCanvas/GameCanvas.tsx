/**
 * PUENTE ENTRE REACT Y EL MOTOR DEL JUEGO.
 *
 * React es muy bueno pintando interfaces que cambian "de vez en cuando"
 * (formularios, menús), pero NO está pensado para repintar 60 veces por
 * segundo. Por eso el juego no usa estado de React: este componente crea
 * un <canvas>, arranca el motor (GameSession + GameLoop) y le cede el
 * control. React solo se entera de lo importante mediante los eventos
 * (cambios de estado, aparición del jefe, victoria, fin de partida).
 *
 * En sentido contrario, el padre puede dar órdenes al motor a través de
 * `ref` (pausar y reanudar), que es lo que usan los botones del menú de pausa.
 *
 * Ciclo de vida (useEffect):
 *   - Al montarse: crea la partida, empieza a escuchar el teclado y arranca el bucle.
 *   - Al desmontarse (cambiar de página, salir al menú): para el bucle y
 *     quita los listeners, para no dejar nada funcionando "en fantasma".
 */
import { getLevel, type DifficultyId, type GameModifiers } from '@pijobeer/shared';
import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
// Importar las imágenes hace que Vite las incluya en el build y nos dé su URL final (con hash)
import alley1Url from '../../assets/sprites/alley-1.webp';
import alley2Url from '../../assets/sprites/alley-2.webp';
import alley3Url from '../../assets/sprites/alley-3.webp';
import bossSheetUrl from '../../assets/sprites/bosses.png';
import foamSheetUrl from '../../assets/sprites/bullet-foam.png';
import openerSheetUrl from '../../assets/sprites/bullet-opener.png';
import enemySheetUrl from '../../assets/sprites/enemy-bottles.png';
import playerSheetUrl from '../../assets/sprites/player.png';
import { ARENA } from '../../game/config';
import { GameLoop } from '../../game/GameLoop';
import {
  GameSession,
  type GameEvents,
  type GameResult,
  type GameStatus,
} from '../../game/GameSession';
import { KeyboardInput } from '../../game/input/KeyboardInput';
import { loadImage } from '../../game/loadImage';
import { renderGame, type RenderAssets, type RenderLabels } from '../../game/renderer';
import styles from './GameCanvas.module.css';

/** Órdenes que el padre puede dar a la partida en curso. */
export interface GameCanvasHandle {
  pause: () => void;
  resume: () => void;
}

interface GameCanvasProps {
  levelId: number;
  /** Trucos de administrador; sin ellos, partida normal. */
  modifiers?: GameModifiers;
  difficulty: DifficultyId;
  onStatusChange: (status: GameStatus) => void;
  onBossAppear?: () => void;
  onVictory: (result: GameResult) => void;
  onGameOver: (result: GameResult) => void;
  /** Contenido que se pinta ENCIMA del canvas (menús de pausa y victoria). */
  children?: ReactNode;
  /** En React 19, `ref` llega como una prop más (antes hacía falta forwardRef). */
  ref?: Ref<GameCanvasHandle>;
}

const ALLEY_URLS = { 1: alley1Url, 2: alley2Url, 3: alley3Url } as const;

/** Imágenes de una partida. Del fondo solo se descarga el callejón de ESE nivel. */
function sheetUrlsFor(levelId: number): Record<keyof RenderAssets, string> {
  return {
    playerSheet: playerSheetUrl,
    enemySheet: enemySheetUrl,
    foamSheet: foamSheetUrl,
    openerSheet: openerSheetUrl,
    bossSheet: bossSheetUrl,
    alley: ALLEY_URLS[getLevel(levelId).alley],
  };
}

export function GameCanvas({
  levelId,
  modifiers,
  difficulty,
  onStatusChange,
  onBossAppear,
  onVictory,
  onGameOver,
  children,
  ref,
}: GameCanvasProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<GameSession | null>(null);

  /* "Última versión" de los callbacks y textos, guardada en refs.
     El motor se crea una sola vez por partida, pero el padre puede pasar
     funciones nuevas o cambiar el idioma a mitad de partida. Leyendo
     siempre de la ref, el motor usa la versión actual sin reiniciarse. */
  const eventsRef = useRef<GameEvents>({});
  const labelsRef = useRef<RenderLabels | null>(null);

  useEffect(() => {
    eventsRef.current = { onStatusChange, onBossAppear, onVictory, onGameOver };
  }, [onStatusChange, onBossAppear, onVictory, onGameOver]);

  useEffect(() => {
    labelsRef.current = {
      hud: (data) => t('play.hud', data),
      gameOver: t('play.gameOver'),
      bossName: (id) => t(`play.bosses.${id}`),
    };
  }, [t]);

  /* Al empezar la partida la pantalla se coloca sola: se desplaza para que
     el juego quede centrado en la ventana, y el foco del teclado pasa al
     canvas (si se quedara en un enlace de la cabecera, Espacio o Enter
     podrían activarlo en mitad de la partida). */
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    canvas?.focus({ preventScroll: true });
  }, [levelId]);

  useImperativeHandle(ref, () => ({
    pause: () => sessionRef.current?.pause(),
    resume: () => sessionRef.current?.resume(),
  }));

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const session = new GameSession({
      levelId,
      modifiers,
      difficulty,
      events: {
        onStatusChange: (status) => eventsRef.current.onStatusChange?.(status),
        onBossAppear: () => eventsRef.current.onBossAppear?.(),
        onVictory: (result) => eventsRef.current.onVictory?.(result),
        onGameOver: (result) => eventsRef.current.onGameOver?.(result),
      },
    });
    sessionRef.current = session;

    const input = new KeyboardInput((action) => {
      if (action === 'pause') session.togglePause();
    });

    /* La partida arranca SIN esperar a las imágenes: mientras se descargan,
       el renderer pinta rectángulos provisionales. En la práctica solo se
       nota la primera vez (luego salen de la caché al instante). */
    const assets: RenderAssets = {
      playerSheet: null,
      enemySheet: null,
      foamSheet: null,
      openerSheet: null,
      bossSheet: null,
      alley: null,
    };
    let disposed = false;
    for (const [key, url] of Object.entries(sheetUrlsFor(levelId)) as Array<
      [keyof RenderAssets, string]
    >) {
      loadImage(url)
        .then((image) => {
          if (!disposed) assets[key] = image;
        })
        .catch((error: unknown) => console.error(`No se pudo cargar ${url}`, error));
    }

    const loop = new GameLoop(
      () => session.step(input),
      () => labelsRef.current && renderGame(ctx, session, labelsRef.current, assets),
    );

    input.attach();
    loop.start();

    return () => {
      disposed = true;
      sessionRef.current = null;
      loop.stop();
      input.detach();
    };
    // Trucos y dificultad se leen al empezar la partida: cambiarlos a mitad no la reinicia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId]);

  return (
    // Contenedor relativo: los menús (children) se colocan encima del canvas
    <div className={styles.wrapper}>
      <canvas
        ref={canvasRef}
        // Tamaño LÓGICO fijo; el CSS lo escala para que quepa en pantallas pequeñas
        width={ARENA.width}
        height={ARENA.height}
        className={styles.canvas}
        // tabIndex -1: se le puede dar el foco por código sin añadirlo al recorrido del Tab
        tabIndex={-1}
        role="img"
        aria-label={t('play.canvasLabel')}
      />
      {children}
    </div>
  );
}
