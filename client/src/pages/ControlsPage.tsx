/**
 * CONTROLES (antes controles.htm).
 *
 * Las teclas se leen de CONTROLS (game/config.ts), la misma configuración
 * que usa el juego. En el original estaban escritas a mano y la página decía
 * "C: Disparar" cuando el juego disparaba con la V. Ahora es imposible que
 * se desincronicen: si cambias una tecla en config.ts, esta página cambia sola.
 *
 * La tecla de la chupa no sale hasta que el jugador desbloquea el nivel en el
 * que se estrena: así no se le adelanta algo que aún no ha visto en el juego.
 */
import { FIRST_JACKET_LEVEL } from '@pijobeer/shared';
import { useTranslation } from 'react-i18next';
import { Panel } from '../components/ui/Panel';
import { useProgress } from '../features/progress/useProgress';
import { CONTROLS } from '../game/config';
import styles from './ControlsPage.module.css';

/** Muestra la tecla en mayúsculas; las flechas como símbolo y el espacio como "␣". */
function keyLabel(key: string): string {
  const special: Record<string, string> = {
    ' ': '␣',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
  };
  return special[key] ?? key.toUpperCase();
}

export function ControlsPage() {
  const { t } = useTranslation();
  const { isLevelUnlocked } = useProgress();
  const movementKeys = [CONTROLS.up, CONTROLS.left, CONTROLS.down, CONTROLS.right]
    .map(keyLabel)
    .join('');

  const rows = [
    { keys: movementKeys, action: t('controls.move') },
    { keys: keyLabel(CONTROLS.shoot), action: t('controls.shoot') },
    ...(isLevelUnlocked(FIRST_JACKET_LEVEL)
      ? [{ keys: keyLabel(CONTROLS.shield), action: t('controls.shield') }]
      : []),
    { keys: keyLabel(CONTROLS.pause), action: t('controls.pause') },
  ];

  return (
    <Panel variant="accent">
      <h2>{t('controls.title')}</h2>
      <dl className={styles.list}>
        {rows.map((row) => (
          <div key={row.action} className={styles.row}>
            <dt>
              <kbd className={styles.key}>{row.keys}</kbd>
            </dt>
            <dd>{row.action}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
