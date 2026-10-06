import { createI18n } from 'vue-i18n';
import { messages, SUPPORTED } from './messages.js';

/** Langue de la page, déclarée par <html lang="…"> (index.html : fr, en/index.html : en). */
const declared = (document.documentElement.lang || 'fr').slice(0, 2);
export const locale = SUPPORTED.includes(declared) ? declared : 'fr';

/** Adresse de la page dans l'autre langue (le fragment #section est conservé au clic). */
export const altLocale = locale === 'fr' ? 'en' : 'fr';
export const altBase = altLocale === 'fr' ? '/' : '/en/';

/**
 * Chaque îlot Vue reçoit sa propre instance vue-i18n (mode Composition API),
 * toutes réglées sur la langue de la page.
 */
export function createAppI18n() {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'fr',
    messages,
  });
}
