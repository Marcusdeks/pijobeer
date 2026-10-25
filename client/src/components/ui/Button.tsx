/**
 * Botón de la aplicación, con sus variantes visuales.
 *
 *   <Button onClick={...}>Jugar</Button>                      -> rojo, redondeado (CTA)
 *   <Button variant="ghost" onClick={...}>Cerrar</Button>     -> transparente con borde
 *   <Button variant="level" disabled>Nivel 2</Button>         -> tarjeta de nivel
 *   <Button variant="neon" onClick={...}>Siguiente</Button>   -> verde neón (menú de victoria)
 *   <Button as="link" to="/play">Iniciar Juego</Button>       -> enlace con aspecto de botón
 *
 * Acepta además cualquier atributo normal de <button> (type, disabled, aria-*...).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './Button.module.css';

type Variant = 'primary' | 'ghost' | 'level' | 'neon';

interface CommonProps {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' };
type LinkProps = CommonProps & { as: 'link'; to: string };

function classNames(variant: Variant, fullWidth?: boolean, extra?: string): string {
  return [styles.button, styles[variant], fullWidth && styles.fullWidth, extra]
    .filter(Boolean)
    .join(' ');
}

export function Button(props: ButtonProps | LinkProps) {
  if (props.as === 'link') {
    const { variant = 'primary', fullWidth, to, children } = props;
    return (
      <Link to={to} className={classNames(variant, fullWidth)}>
        {children}
      </Link>
    );
  }

  const {
    variant = 'primary',
    fullWidth,
    className,
    children,
    type = 'button',
    as: _as,
    ...rest
  } = props;
  return (
    // type="button" por defecto: un <button> dentro de un <form> enviaría el formulario sin querer
    <button type={type} className={classNames(variant, fullWidth, className)} {...rest}>
      {children}
    </button>
  );
}
