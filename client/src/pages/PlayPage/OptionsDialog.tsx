/**
 * Ventana de OPCIONES del menú de "Jugar": dificultad y música.
 *
 * Cada apartado es una <section> con su título, para que añadir opciones
 * nuevas (p. ej. la skin del personaje) sea añadir otra sección más.
 *
 * Todo se aplica al momento, sin botón de "Guardar": la dificultad la
 * recuerda useDifficulty y la música el propio reproductor, así que al
 * cambiar de estilo o de volumen se oye el resultado mientras se elige.
 */
import { DIFFICULTY_IDS, type DifficultyId } from '@pijobeer/shared';
import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { checkMp3File, MAX_MP3_MB } from '../../audio/mp3File';
import { music, MUSIC_STYLES, type MusicStyle } from '../../audio/music';
import { useMusicSettings } from '../../audio/useMusicSettings';
import { Dialog } from '../../components/ui/Dialog';
import styles from './OptionsDialog.module.css';

interface OptionsDialogProps {
  difficulty: DifficultyId;
  onDifficultyChange: (difficulty: DifficultyId) => void;
  onClose: () => void;
}

const STYLE_OPTIONS: MusicStyle[] = [...MUSIC_STYLES, 'custom'];

export function OptionsDialog({ difficulty, onDifficultyChange, onClose }: OptionsDialogProps) {
  const { t } = useTranslation();
  const settings = useMusicSettings();
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Se vacía el campo para que volver a elegir el mismo archivo también dispare el evento
    event.target.value = '';
    if (!file) return;

    const problem = await checkMp3File(file);
    setUploadError(problem && t(`options.errors.${problem}`, { max: MAX_MP3_MB }));
    if (!problem) await music.setCustomTrack(file);
  }

  return (
    <Dialog title={t('options.title')} onClose={onClose}>
      <section className={styles.section}>
        {/* Radios nativos: se eligen con flechas del teclado y los lectores de pantalla los anuncian */}
        <fieldset className={styles.choices}>
          <legend>{t('options.difficulty')}</legend>
          {DIFFICULTY_IDS.map((id) => (
            <label key={id}>
              <input
                type="radio"
                name="difficulty"
                value={id}
                checked={difficulty === id}
                onChange={() => onDifficultyChange(id)}
              />
              <span>{t(`options.difficulties.${id}`)}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className={styles.section}>
        <h3>{t('options.music')}</h3>

        <label className={styles.volume}>
          <span>{t('options.volume')}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(settings.volume * 100)}
            onChange={(event) => music.setVolume(Number(event.target.value) / 100)}
          />
          <output>{Math.round(settings.volume * 100)} %</output>
        </label>

        <fieldset className={styles.choices}>
          <legend>{t('options.style')}</legend>
          {STYLE_OPTIONS.map((style) => (
            <label key={style}>
              <input
                type="radio"
                name="musicStyle"
                value={style}
                checked={settings.style === style}
                // "Tu canción" no se puede elegir hasta haber subido una
                disabled={style === 'custom' && !settings.customTrackName}
                onChange={() => music.setStyle(style)}
              />
              <span>{t(`options.styles.${style}`)}</span>
            </label>
          ))}
        </fieldset>

        {!settings.available && settings.style !== 'custom' && (
          <p className={styles.hint}>{t('options.noTracks')}</p>
        )}

        {/* El <input type="file"> nativo no se puede decorar: se oculta y su <label> hace de botón */}
        <label className={styles.upload}>
          {t('options.upload')}
          <input type="file" accept=".mp3,audio/mpeg" onChange={handleUpload} />
        </label>
        {settings.customTrackName && (
          <p className={styles.hint}>
            {t('options.customTrack', { name: settings.customTrackName })}
          </p>
        )}
        {uploadError && (
          <p className={styles.error} role="alert">
            {uploadError}
          </p>
        )}
      </section>
    </Dialog>
  );
}
