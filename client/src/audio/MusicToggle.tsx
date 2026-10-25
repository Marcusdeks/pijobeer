/**
 * Botón de la cabecera para silenciar o activar la música.
 * Solo aparece si el estilo elegido tiene canciones (ver audio/music.ts).
 */
import { useTranslation } from 'react-i18next';
import { music } from './music';
import styles from './MusicToggle.module.css';
import { useMusicSettings } from './useMusicSettings';

export function MusicToggle() {
  const { t } = useTranslation();
  const { muted, available } = useMusicSettings();

  if (!available) return null;

  const label = muted ? t('music.unmute') : t('music.mute');
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => music.toggleMute()}
      aria-label={label}
      title={label}
      aria-pressed={!muted}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
