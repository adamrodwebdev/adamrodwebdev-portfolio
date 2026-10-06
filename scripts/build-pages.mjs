/**
 * Génère les pages statiques traduites à partir de templates/index.html
 * et des traductions de js/i18n/messages.js (les mêmes que celles de vue-i18n).
 *
 *   node scripts/build-pages.mjs
 *
 * Produit : index.html (français) et en/index.html (anglais).
 * Aucune dépendance : Node 18 ou plus suffit.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { messages } from '../js/i18n/messages.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://adamrodwebdev.com';

const pages = {
  fr: { base: '/', out: 'index.html', thanks: '/merci.html', legal: '/mentions-legales.html', langName: 'Français' },
  en: { base: '/en/', out: 'en/index.html', thanks: '/en/thank-you.html', legal: '/en/legal-notice.html', langName: 'English' },
};

const escape = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const lookup = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/** Les messages vue-i18n peuvent contenir {param} : ils ne doivent pas apparaître dans les pages statiques. */
function text(locale, key) {
  const v = lookup(messages[locale], key);
  if (typeof v !== 'string') throw new Error(`Traduction manquante : ${locale}.${key}`);
  if (/[{}]/.test(v)) throw new Error(`Paramètre vue-i18n non résolu dans ${locale}.${key}`);
  return escape(v);
}

const template = await readFile(join(ROOT, 'templates/index.html'), 'utf8');

for (const [locale, page] of Object.entries(pages)) {
  const other = locale === 'fr' ? 'en' : 'fr';
  const m = messages[locale];
  const special = {
    lang: locale,
    url: ORIGIN + page.base,
    urlFr: ORIGIN + pages.fr.base,
    urlEn: ORIGIN + pages.en.base,
    origin: ORIGIN,
    ogAltLocale: messages[other].meta.ogLocale,
    altBase: pages[other].base,
    altLang: other,
    altLangName: pages[other].langName,
    thanks: page.thanks,
    legal: page.legal,
    typeOptions: m.form.types.map((o) => `<option>${escape(o)}</option>`).join(''),
    budgetOptions: m.form.budgets.map((o) => `<option>${escape(o)}</option>`).join(''),
    sendLabel: escape(m.form.steps[0]),
  };

  const html = template.replace(/\[\[(@?)([\w.-]+)\]\]/g, (_, at, key) => {
    if (at) {
      if (!(key in special)) throw new Error(`Variable inconnue : @${key}`);
      return special[key];
    }
    return text(locale, key);
  });

  const target = join(ROOT, page.out);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
  console.log(`✔ ${page.out}`);
}
