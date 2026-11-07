/**
 * Ventana emergente para elegir nivel (el antiguo "popup-nivel").
 * Los niveles bloqueados se ven, pero desactivados y con lo que piden para
 * abrirse: superar el anterior (sin cifras: cuánto hay que eliminar en cada
 * nivel no se desvela, ver GameRules.killGoal).
 */
import { LEVELS } from '@pijobeer/shared';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import styles from './LevelSelectDialog.module.css';

interface LevelSelectDialogProps {
  isLevelUnlocked: (levelId: number) => boolean;
  onSelect: (levelId: number) => void;
  onClose: () => void;
}

export function LevelSelectDialog({ isLevelUnlocked, onSelect, onClose }: LevelSelectDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog title={t('play.chooseLevelTitle')} onClose={onClose}>
      <div className={styles.levels}>
        {LEVELS.map((level, index) => {
          const unlocked = isLevelUnlocked(level.id);
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
                  {t('play.levelRequirement', { level: previous.id })}
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </Dialog>
  );
}
