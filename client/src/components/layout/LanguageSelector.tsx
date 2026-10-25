/**
 * SELECTOR DE IDIOMA (desplegable con banderas).
 *
 * El original se abría solo al pasar el ratón por encima (:hover), así que
 * en móvil y con teclado no se podía usar. Ahora:
 *   - Se abre y cierra con clic (o Enter/Espacio con el teclado).
 *   - Se cierra al elegir idioma, al pulsar Escape o al hacer clic fuera.
 *   - Usa los atributos ARIA estándar de un menú desplegable.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import flagEn from '../../assets/images/flag-en.png';
import flagEs from '../../assets/images/flag-es.png';
import flagFr from '../../assets/images/flag-fr.png';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type Language } from '../../i18n';
import styles from './LanguageSelector.module.css';

/* Importar las imágenes (en vez de escribir su ruta como texto) hace que Vite
   las procese: les añade un hash al nombre para la caché y avisa al compilar
   si un archivo no existe. Se acabaron las rutas rotas con "../imagenes". */
const FLAGS: Record<Language, string> = { es: flagEs, en: flagEn, fr: flagFr };

function isSupported(language: string): language is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language);
}

export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current: Language = isSupported(i18n.resolvedLanguage ?? '')
    ? (i18n.resolvedLanguage as Language)
    : DEFAULT_LANGUAGE;

  // Cerrar al hacer clic fuera o al pulsar Escape (solo mientras está abierto)
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    // Limpieza: quitamos los listeners al cerrarse, para no dejarlos colgados
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function selectLanguage(language: Language) {
    void i18n.changeLanguage(language);
    setIsOpen(false);
  }

  return (
    <div className={styles.dropdown} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`${t('nav.language')}: ${t(`languages.${current}`)}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <img src={FLAGS[current]} alt="" className={styles.flag} />
        <span className={styles.triggerLabel}>{t(`languages.${current}`)}</span>
      </button>

      {isOpen && (
        <ul className={styles.menu} role="menu">
          {SUPPORTED_LANGUAGES.map((language) => (
            <li key={language} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={language === current}
                className={styles.item}
                // lang: el lector de pantalla pronuncia "Français" en francés
                lang={language}
                onClick={() => selectLanguage(language)}
              >
                <img src={FLAGS[language]} alt="" className={styles.flag} />
                <span>{t(`languages.${language}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
