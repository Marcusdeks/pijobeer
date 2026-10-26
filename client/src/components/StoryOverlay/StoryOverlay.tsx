/**
 * TEXTO DE HISTORIA SOBRE EL JUEGO (diálogos y avisos con la partida parada).
 *
 * Se pinta encima del canvas, como los menús de pausa y victoria, y por el
 * mismo motivo es HTML: se traduce, se lee con lector de pantalla y el botón
 * funciona con teclado.
 *
 * Se cierra solo al cabo de `durationMs` (el tiempo pensado para leerlo) o,
 * si hay `skipLabel`, antes con el botón de saltar.
 *
 *   <StoryOverlay lines={['Marcus: ...', 'Pijos: ...']} durationMs={8000}
 *                 skipLabel="Saltar" onClose={...} />
 */
import { useEffect, useRef } from 'react';
// Misma fuente pixel art que el menú de victoria (ver GameOverlay)
import '@fontsource/press-start-2p/400.css';
import { Button } from '../ui/Button';
import styles from './StoryOverlay.module.css';

interface StoryOverlayProps {
  /** Párrafos ya traducidos, en orden. */
  lines: readonly string[];
  /** Milisegundos que se queda en pantalla antes de cerrarse solo. */
  durationMs: number;
  /** Texto del botón para saltarlo. Sin él, no hay botón. */
  skipLabel?: string;
  onClose: () => void;
}

export function StoryOverlay({ lines, durationMs, skipLabel, onClose }: StoryOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  /* La última versión de onClose en una ref: si el padre se vuelve a pintar
     y pasa una función nueva, el temporizador no se reinicia. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  // Con botón, el foco va a él: así se salta con Enter sin coger el ratón
  useEffect(() => {
    overlayRef.current?.querySelector('button')?.focus();
  }, []);

  return (
    // role="dialog" + aria-live: los lectores de pantalla leen el texto al aparecer
    <div ref={overlayRef} className={styles.overlay} role="dialog" aria-live="assertive">
      <div className={styles.box}>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {skipLabel && (
        <Button variant="ghost" onClick={onClose}>
          {skipLabel}
        </Button>
      )}
    </div>
  );
}
