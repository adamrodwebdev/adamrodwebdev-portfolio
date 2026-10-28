/**
 * Génère les pages statiques traduites à partir de templates/index.html
 * et des traductions de js/i18n/messages.js (les mêmes que celles de vue-i18n),
 * puis la page du jeu Lumirift (templates/lumirift.html, en anglais seulement).
 *
 *   node scripts/build-pages.mjs
 *
 * Produit : index.html (français), en/index.html (anglais) et lumirift/index.html.
 * Aucune dépendance : Node 18 ou plus suffit.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { messages, lumiriftPage } from '../js/i18n/messages.js';
import { config } from '../js/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://adamrodwebdev.com';

const pages = {
  fr: { base: '/', out: 'index.html', thanks: '/merci.html', legal: '/mentions-legales.html', langName: 'Français' },
  en: { base: '/en/', out: 'en/index.html', thanks: '/en/thank-you.html', legal: '/en/legal-notice.html', langName: 'English' },
};

const escape = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const lookup = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/**
 * Remplit un gabarit : [[clé]] lit un texte de `texts` (échappé), [[@nom]] une valeur calculée.
 * Les messages vue-i18n peuvent contenir {param} : ils ne doivent pas apparaître dans les pages statiques.
 */
function render(template, texts, special, where) {
  return template.replace(/\[\[(@?)([\w.-]+)\]\]/g, (_, at, key) => {
    if (at) {
      if (!(key in special)) throw new Error(`Variable inconnue : @${key}`);
      return special[key];
    }
    const v = lookup(texts, key);
    if (typeof v !== 'string') throw new Error(`Traduction manquante : ${where}.${key}`);
    if (/[{}]/.test(v)) throw new Error(`Paramètre vue-i18n non résolu dans ${where}.${key}`);
    return escape(v);
  });
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
    contactEmail: escape(config.contactEmail),
  };

  const html = render(template, messages[locale], special, locale);

  const target = join(ROOT, page.out);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
  console.log(`✔ ${page.out}`);
}

/**
 * La page du jeu Lumirift (1.8.0), l'adresse que donnent les réseaux : en anglais seulement,
 * avec l'en-tête et le pied de page anglais du site. Son clip et ses images sont dans lumirift/.
 */
const LUMIRIFT = {
  out: 'lumirift/index.html',
  url: `${ORIGIN}/lumirift/`,
  play: 'https://playgama.ai/play/be4bqnmqcv',
  fonts: 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Rajdhani:wght@500;600;700&display=swap',
  // Unbounded, la police du titre du jeu, réduite par Google Fonts aux lettres du titre.
  titleFont: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@900&text=LUMIRFTBOCKS&display=swap',
  // Le clip du lundi 2 novembre (la fabrique de clips du jeu, 1.39) : 7,8 s, son affiche à 0,47 s.
  clipDate: '2026-10-28',
  clipDuration: 'PT7.8S',
  posterTime: '0.467',
  social: {
    youtube: 'https://www.youtube.com/@adamrodwebdev',
    github: 'https://github.com/adamrodwebdev/lumirift',
    tiktok: 'https://www.tiktok.com/@adamrodwebdev',
    instagram: 'https://www.instagram.com/adamrodwebdev/',
  },
};

const lumirift = render(
  await readFile(join(ROOT, 'templates/lumirift.html'), 'utf8'),
  { ...messages.en, page: lumiriftPage },
  {
    origin: ORIGIN,
    url: LUMIRIFT.url,
    play: LUMIRIFT.play,
    fonts: LUMIRIFT.fonts,
    titleFont: LUMIRIFT.titleFont,
    clipDate: LUMIRIFT.clipDate,
    clipDuration: LUMIRIFT.clipDuration,
    posterTime: LUMIRIFT.posterTime,
    // Une colonne sur téléphone, deux puis trois ensuite (la grille des cartes, 18rem au moins).
    cardSizes: '(width >= 64rem) 23rem, (width >= 41rem) calc(50vw - 3rem), calc(100vw - 2rem)',
    ...LUMIRIFT.social,
  },
  'lumirift',
);
const target = join(ROOT, LUMIRIFT.out);
await mkdir(dirname(target), { recursive: true });
await writeFile(target, lumirift);
console.log(`✔ ${LUMIRIFT.out}`);
