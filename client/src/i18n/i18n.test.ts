/**
 * Red de seguridad de las traducciones: si alguien añade un texto en
 * español y se olvida de traducirlo al inglés o al francés, este test falla.
 */
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@pijobeer/shared';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

/** Aplana { a: { b: 'x' } } en ['a.b'] para poder comparar claves. */
function flattenKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flattenKeys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

/** Variables {{x}} que usa cada texto, para comprobar que coinciden entre idiomas. */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!).sort();
}

function valueAt(obj: object, path: string): string {
  return path
    .split('.')
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], obj) as string;
}

const reference = flattenKeys(es).sort();

describe('traducciones', () => {
  it.each([
    ['en', en],
    ['fr', fr],
  ])('"%s" tiene exactamente las mismas claves que "es"', (_name, locale) => {
    expect(flattenKeys(locale).sort()).toEqual(reference);
  });

  it.each([
    ['en', en],
    ['fr', fr],
  ])('"%s" usa las mismas variables {{...}} que "es"', (_name, locale) => {
    for (const key of reference) {
      expect(placeholders(valueAt(locale, key)), key).toEqual(placeholders(valueAt(es, key)));
    }
  });

  it('cada código de error del servidor tiene su traducción', () => {
    for (const code of ERROR_CODES) {
      expect(es.errors, code).toHaveProperty(code);
    }
  });
});
