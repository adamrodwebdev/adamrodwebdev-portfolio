import { createI18n } from 'vue-i18n';
import { LANGUAGES, languageOf } from './languages.js';

/** Langue de la page, déclarée par <html lang="…"> (index.html : fr, en/index.html : en, ru/, it/, es/…). */
export const locale = languageOf((document.documentElement.lang || '').slice(0, 2)).code;

/** Les langues du site, dans l'ordre du menu. */
export const languages = LANGUAGES;

/**
 * Les textes de la langue de la page seulement (1.10.0) : les autres langues ne sont jamais téléchargées.
 * La génération précharge ce module avec les îlots, l'import ne refait donc aucune requête.
 */
export const loadMessages = () => import(`./locales/${locale}.js`).then((module) => module.default);

/**
 * Chaque îlot Vue reçoit sa propre instance vue-i18n (mode Composition API),
 * réglée sur la langue de la page, avec ses seuls textes.
 */
export function createAppI18n(messages) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: locale,
    messages: { [locale]: messages },
  });
}
