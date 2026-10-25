/**
 * Campo de formulario: etiqueta + input (+ pista opcional).
 *
 * useId() genera un id único para enlazar <label htmlFor> con <input id>.
 * Así, al pulsar la etiqueta se enfoca el campo y los lectores de pantalla
 * leen la etiqueta correcta, sin tener que inventar ids a mano.
 */
import { useId, type InputHTMLAttributes } from 'react';
import styles from './FormField.module.css';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Texto de ayuda bajo el campo (p. ej. las reglas del nombre de usuario). */
  hint?: string;
}

export function FormField({ label, hint, ...inputProps }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input id={id} className={styles.input} aria-describedby={hintId} {...inputProps} />
      {hint && (
        <small id={hintId} className={styles.hint}>
          {hint}
        </small>
      )}
    </div>
  );
}
