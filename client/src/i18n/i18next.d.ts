/**
 * Claves de traducción TIPADAS.
 *
 * Con esta declaración, TypeScript conoce la estructura de es.json y:
 *   - Autocompleta las claves al escribir t('...').
 *   - Da error de compilación si una clave no existe (p. ej. t('home.titel')).
 * Una errata en una clave deja de ser un texto roto en producción para
 * convertirse en un error que se ve antes de ejecutar nada.
 */
import 'i18next';
import type es from './locales/es.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof es };
  }
}
