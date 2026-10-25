/**
 * Contenedor con el fondo degradado oscuro de la marca.
 *
 *   variant="framed"  -> borde rojo completo (portada, formularios)
 *   variant="accent"  -> solo una franja roja a la izquierda (controles, tablas)
 *   size="narrow"     -> ancho de formulario (420px), centrado
 */
import type { ElementType, ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  variant?: 'framed' | 'accent';
  size?: 'full' | 'narrow';
  /** Etiqueta HTML a usar (section por defecto). */
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export function Panel({
  variant = 'framed',
  size = 'full',
  as: Tag = 'section',
  className,
  children,
}: PanelProps) {
  const classes = [styles.panel, styles[variant], size === 'narrow' && styles.narrow, className]
    .filter(Boolean)
    .join(' ');
  return <Tag className={classes}>{children}</Tag>;
}
