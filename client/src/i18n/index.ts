/**
 * INTERNACIONALIZACIÓN (i18n) con i18next.
 *
 * Sustituye a idiomas.js, que traducía la página EN DIRECTO con la API de
 * MyMemory: una petición HTTP por cada texto de la pantalla, en serie. Eso
 * era lento, dependía de un servicio externo con límite diario, y la calidad
 * de traducción automática no se podía controlar.
 *
 * Ahora cada idioma es un archivo JSON (locales/es.json, en.json, fr.json)
 * con TODOS los textos ya traducidos. Cambiar de idioma es instantáneo.
 *
 * Uso en un componente:
 *     const { t } = useTranslation();
 *     <h2>{t('home.title')}</h2>
 *     <p>{t('play.level', { level: 2 })}</p>   // "Nivel 2"
 *
 * Para AÑADIR UN IDIOMA: crea locales/xx.json copiando es.json, tradúcelo,
 * y añádelo a SUPPORTED_LANGUAGES y a "resources". El test i18n.test.ts
 * comprueba que no falte ninguna clave en ningún idioma.
 */
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['es', 'en', 'fr'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'es';

/** Clave de localStorage donde se recuerda el idioma elegido. */
const STORAGE_KEY = 'pijobeer.language';

void i18n
  // Detecta el idioma: primero el que se eligió la última vez, si no el del navegador
  .use(LanguageDetector)
  // Conecta i18next con React (hook useTranslation)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      fr: { translation: fr },
    },
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,
    // "es-ES" -> "es": no necesitamos variantes regionales
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      // React ya escapa el texto al pintarlo (evita inyección de HTML), no hace falta hacerlo dos veces
      escapeValue: false,
    },
  });

// Mantiene <html lang="..."> al día: lo usan los lectores de pantalla y los buscadores
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});

export default i18n;
