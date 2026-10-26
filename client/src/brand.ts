/**
 * NOMBRES PROPIOS: el del juego, el del autor, el del grupo de la música y el
 * del protagonista.
 *
 * Nunca se traducen, así que no se escriben en los textos de i18n/locales/*.json:
 * allí se usan como variables ({{game}}, {{author}}, {{band}}, {{hero}}) e i18next las
 * rellena siempre con estos valores (defaultVariables en i18n/index.ts). Así
 * cada nombre está escrito en un único sitio, ningún idioma puede cambiarlo
 * sin querer y renombrar algo es tocar una línea.
 */
export const BRAND = {
  game: 'Pijo Beer',
  author: 'Marcusdeks',
  band: 'Hueste Negra',
  hero: 'Marcus',
} as const;
