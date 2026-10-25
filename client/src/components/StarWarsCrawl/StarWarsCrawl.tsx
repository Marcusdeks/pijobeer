/**
 * TEXTO DESLIZANTE estilo Star Wars con la historia del juego.
 *
 * Se usa en DOS sitios: la página "Historia" (en bucle) y la intro antes de
 * jugar (una sola vez, con botón de saltar). En el original el texto estaba
 * copiado y pegado en historia.htm y juego.htm; ahora vive en los ficheros
 * de idioma y este componente lo pinta en ambos sitios.
 */
import { useTranslation } from 'react-i18next';
import coverImage from '../../assets/images/cover.jpg';
import styles from './StarWarsCrawl.module.css';

interface StarWarsCrawlProps {
  /** true = se reproduce una vez y llama a onFinished al terminar (intro del juego). */
  playOnce?: boolean;
  onFinished?: () => void;
  /** Si se indica, muestra un botón "Saltar" que llama a esta función. */
  onSkip?: () => void;
}

const PARAGRAPHS_BEFORE_IMAGE = [
  'story.p1',
  'story.p2',
  'story.p3',
  'story.p4',
  'story.p5',
] as const;

export function StarWarsCrawl({ playOnce = false, onFinished, onSkip }: StarWarsCrawlProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.container}>
      {onSkip && (
        <button type="button" className={styles.skip} onClick={onSkip}>
          {t('play.skipIntro')}
        </button>
      )}

      {/* Capa 1: la inclinación 3D, fija */}
      <div className={styles.perspective}>
        {/* Capa 2: el texto que sube. onAnimationEnd salta cuando termina la
            animación CSS: así no hay que calcular a mano cuánto dura la intro */}
        <div
          className={`${styles.text} ${playOnce ? styles.once : styles.loop}`}
          onAnimationEnd={playOnce ? onFinished : undefined}
        >
          <h2>{t('story.title')}</h2>
          {PARAGRAPHS_BEFORE_IMAGE.map((key) => (
            <p key={key}>{t(key)}</p>
          ))}
          <img src={coverImage} alt={t('story.imageAlt')} className={styles.image} />
          <p>{t('story.p6')}</p>
        </div>
      </div>
    </section>
  );
}
