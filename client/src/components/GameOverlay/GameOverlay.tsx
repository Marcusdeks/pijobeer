/**
 * MENÚ SUPERPUESTO AL JUEGO (pausa y victoria).
 *
 * Se pinta encima del canvas, oscureciéndolo. Es HTML y no dibujo del canvas
 * a propósito: los botones se pueden usar con ratón, con teclado (Tab/Enter)
 * y con lectores de pantalla, y se traducen como el resto de la web.
 *
 *   <GameOverlay variant="victory" title="¡VICTORIA!" subtitle="...">
 *     <Button variant="neon">Siguiente nivel</Button>
 *   </GameOverlay>
 *
 * Al aparecer, el foco pasa al primer botón: así se puede continuar con
 * Enter sin coger el ratón.
 */
import { useEffect, useRef, type ReactNode } from 'react';
/* Fuente pixel art "Press Start 2P" para el menú de victoria. Va instalada
   en el proyecto (paquete @fontsource) en vez de cargarse desde Google:
   funciona sin internet y no depende de un servicio externo. */
import '@fontsource/press-start-2p/400.css';
import styles from './GameOverlay.module.css';

interface GameOverlayProps {
  /** 'pause' = textos blancos; 'victory' = textos verde neón. */
  variant: 'pause' | 'victory';
  title: string;
  /** Líneas de texto bajo el título (resumen, nivel desbloqueado...). */
  subtitle?: ReactNode;
  /** Los botones del menú. */
  children: ReactNode;
}

export function GameOverlay({ variant, title, subtitle, children }: GameOverlayProps) {
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    actionsRef.current?.querySelector<HTMLElement>('button, a')?.focus();
  }, []);

  return (
    // role="dialog": los lectores de pantalla anuncian el menú al aparecer
    <div className={`${styles.overlay} ${styles[variant]}`} role="dialog" aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      <div className={styles.actions} ref={actionsRef}>
        {children}
      </div>
    </div>
  );
}
