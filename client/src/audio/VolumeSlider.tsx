/**
 * Control de la música: el altavoz (silenciar / activar) y la barra del
 * volumen. Está en Opciones y en el menú de pausa; el cambio se oye al
 * momento y se recuerda en el navegador (ver audio/music.ts).
 */
import { useTranslation } from 'react-i18next';
import { music } from './music';
import { useMusicSettings } from './useMusicSettings';
import styles from './VolumeSlider.module.css';

export function VolumeSlider() {
  const { t } = useTranslation();
  const { muted, volume } = useMusicSettings();
  const percent = Math.round(volume * 100);
  const muteLabel = muted ? t('music.unmute') : t('music.mute');

  return (
    <div className={styles.volume}>
      <button
        type="button"
        className={styles.speaker}
        onClick={() => music.toggleMute()}
        aria-label={muteLabel}
        title={muteLabel}
        aria-pressed={muted}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <label className={styles.slider}>
        <span>{t('options.volume')}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          onChange={(event) => music.setVolume(Number(event.target.value) / 100)}
        />
        <output>{percent} %</output>
      </label>
    </div>
  );
}
