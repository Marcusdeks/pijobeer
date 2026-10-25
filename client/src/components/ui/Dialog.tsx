/**
 * Ventana emergente (modal) de la aplicación: título, contenido y "Cerrar".
 *
 * Usa <dialog>, el elemento nativo del navegador para ventanas modales:
 * con showModal() el navegador ya se encarga de oscurecer el fondo, de
 * impedir hacer clic detrás, de cerrar con Escape y de mantener el foco
 * del teclado dentro de la ventana. Antes todo eso había que programarlo a mano.
 *
 * Se abre al montarse: el padre decide si se ve renderizándola o no.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import styles from './Dialog.module.css';

interface DialogProps {
  title: string;
  /** Se llama al cerrar, sea con el botón o con Escape. */
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ title, onClose, children }: DialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    // onClose del <dialog> también se dispara al pulsar Escape
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      {children}
      <Button variant="ghost" className={styles.close} onClick={() => dialogRef.current?.close()}>
        {t('common.close')}
      </Button>
    </dialog>
  );
}
