/**
 * Aviso de error o de éxito.
 *
 * Mantiene lo que pedía el perfil original: al aparecer recibe el FOCO (la
 * página salta hasta él aunque estés abajo del formulario y los lectores de
 * pantalla lo leen en voz alta) y puede desaparecer solo a los X segundos.
 *
 * El componente padre decide cuándo enseñarlo; Alert solo avisa con
 * onDismiss cuando se cumple el tiempo.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Alert.module.css';

interface AlertProps {
  type: 'error' | 'success';
  children: ReactNode;
  /** Milisegundos hasta llamar a onDismiss. Sin valor, el aviso se queda. */
  autoDismissMs?: number;
  onDismiss?: () => void;
  /** Dar el foco al aparecer (por defecto sí). */
  focusOnMount?: boolean;
}

export function Alert({
  type,
  children,
  autoDismissMs,
  onDismiss,
  focusOnMount = true,
}: AlertProps) {
  const ref = useRef<HTMLDivElement>(null);

  /* Guardamos onDismiss en una ref para no reiniciar el temporizador cada vez
     que el padre se repinta (p. ej. mientras el jugador escribe en el
     formulario), ya que el padre suele pasar una función nueva en cada render. */
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount, children]);

  useEffect(() => {
    if (!autoDismissMs) return;
    const timer = setTimeout(() => onDismissRef.current?.(), autoDismissMs);
    // Limpieza: si el aviso cambia o desaparece antes, se cancela el temporizador.
    // (Equivale al clearTimeout que hacía perfil.js a mano)
    return () => clearTimeout(timer);
  }, [autoDismissMs, children]);

  return (
    <div
      ref={ref}
      // tabIndex -1: permite dar el foco por código a un div (que normalmente no lo admite)
      tabIndex={-1}
      // "alert" interrumpe al lector de pantalla para los errores; "status" espera su turno
      role={type === 'error' ? 'alert' : 'status'}
      className={`${styles.alert} ${styles[type]}`}
    >
      {children}
    </div>
  );
}
