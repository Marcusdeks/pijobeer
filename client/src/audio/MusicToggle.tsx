/**
 * Botón de la cabecera para silenciar o activar la música.
 * Solo aparece si hay canciones (ver audio/music.ts).
 *
 * useSyncExternalStore es la forma estándar de React de leer un estado que
 * vive fuera de React (aquí, el reproductor) y repintarse cuando cambia.
 */
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { music } from './music';
import styles from './MusicToggle.module.css';

export function MusicToggle() {
  const { t } = useTranslation();
  const muted = useSyncExternalStore(music.subscribe, () => music.isMuted);

  if (!music.available) return null;

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
