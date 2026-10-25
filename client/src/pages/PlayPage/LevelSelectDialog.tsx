/**
 * Ventana emergente para elegir nivel (el antiguo "popup-nivel").
 *
 * Usa <dialog>, el elemento nativo del navegador para ventanas modales:
 * con showModal() el navegador ya se encarga de oscurecer el fondo, de
 * impedir hacer clic detrás, de cerrar con Escape y de mantener el foco
 * del teclado dentro de la ventana. Antes todo eso había que programarlo a mano.
 */
import { LEVELS } from '@pijobeer/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import styles from './LevelSelectDialog.module.css';

interface LevelSelectDialogProps {
  isLevelUnlocked: (levelId: number) => boolean;
  onSelect: (levelId: number) => void;
  onClose: () => void;
}

export function LevelSelectDialog({ isLevelUnlocked, onSelect, onClose }: LevelSelectDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Se abre en modo modal en cuanto se monta el componente
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    // onClose del <dialog> también se dispara al pulsar Escape
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      aria-labelledby="level-dialog-title"
    >
      <h2 id="level-dialog-title">{t('play.chooseLevelTitle')}</h2>

      <div className={styles.levels}>
        {LEVELS.map((level, index) => {
          const unlocked = isLevelUnlocked(level.id);
          // El requisito de un nivel está definido en el nivel ANTERIOR
          const previous = LEVELS[index - 1];

          return (
            <Button
              key={level.id}
              variant="level"
              disabled={!unlocked}
              onClick={() => onSelect(level.id)}
            >
              {t('play.level', { level: level.id })}
              {!unlocked && previous && (
                <span className={styles.requirement}>
                  {t('play.levelRequirement', {
                    count: previous.killsToComplete,
                    level: previous.id,
                  })}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <Button variant="ghost" className={styles.close} onClick={() => dialogRef.current?.close()}>
        {t('play.close')}
      </Button>
    </dialog>
  );
}
