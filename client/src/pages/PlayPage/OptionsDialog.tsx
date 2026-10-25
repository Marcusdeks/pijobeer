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
import { MP3_LIMITS, selectMp3Files } from '../../audio/mp3File';
import { music, MUSIC_STYLES, type MusicStyle } from '../../audio/music';
import { useMusicSettings } from '../../audio/useMusicSettings';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import styles from './OptionsDialog.module.css';

interface OptionsDialogProps {
  difficulty: DifficultyId;
  onDifficultyChange: (difficulty: DifficultyId) => void;
  onClose: () => void;
}

const STYLE_OPTIONS: MusicStyle[] = [...MUSIC_STYLES, 'custom'];

/**
 * "webkitdirectory" hace que el selector de archivos elija una CARPETA entera.
 * Lo admiten todos los navegadores actuales, pero React no lo conoce como
 * propiedad, así que se pone directamente en el elemento.
 */
const asFolderPicker = (input: HTMLInputElement | null) =>
  input?.setAttribute('webkitdirectory', '');

export function OptionsDialog({ difficulty, onDifficultyChange, onClose }: OptionsDialogProps) {
  const { t } = useTranslation();
  const settings = useMusicSettings();
  const [uploadMessages, setUploadMessages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    // Se vacía el campo para que volver a elegir lo mismo también dispare el evento
    event.target.value = '';
    if (!files.length) return;

    setUploading(true);
    const { tracks, skipped, limitReached } = await selectMp3Files(files);
    const messages = [];
    if (skipped) messages.push(t('options.errors.skipped', { n: skipped }));
    if (limitReached) {
      messages.push(t('options.errors.limit', { files: MP3_LIMITS.files, mb: MP3_LIMITS.totalMB }));
    }
    if (!tracks.length) messages.push(t('options.errors.noTracks'));
    else if (!(await music.setCustomTracks(tracks))) messages.push(t('options.errors.notSaved'));
    setUploadMessages(messages);
    setUploading(false);
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
                // "Tu música" no se puede elegir hasta haber subido alguna canción
                disabled={style === 'custom' && !settings.customTrackCount}
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
        <div className={styles.uploads} aria-busy={uploading}>
          <label className={styles.upload}>
            {t('options.uploadFiles')}
            <input
              type="file"
              accept=".mp3,audio/mpeg"
              multiple
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          <label className={styles.upload}>
            {t('options.uploadFolder')}
            <input type="file" ref={asFolderPicker} onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
        <p className={styles.hint}>
          {t('options.uploadLimits', { file: MP3_LIMITS.fileMB, total: MP3_LIMITS.totalMB })}
        </p>

        {settings.customTrackCount > 0 && (
          <p className={styles.hint}>
            {t('options.customTracks', { n: settings.customTrackCount })}
          </p>
        )}
        {settings.currentCustomTrack && (
          <div className={styles.nowPlaying}>
            <p className={styles.hint}>
              {t('options.nowPlaying', { name: settings.currentCustomTrack })}
            </p>
            {settings.customTrackCount > 1 && (
              <Button variant="ghost" onClick={() => music.nextTrack()}>
                {t('options.nextTrack')}
              </Button>
            )}
          </div>
        )}
        {uploadMessages.map((message) => (
          <p key={message} className={styles.error} role="alert">
            {message}
          </p>
        ))}
      </section>
    </Dialog>
  );
}
