/**
 * Génère les pages statiques traduites à partir de templates/index.html
 * et des traductions de js/i18n/messages.js (les mêmes que celles de vue-i18n),
 * puis la page du jeu Lumirift (templates/lumirift.html, en anglais seulement).
 *
 *   node scripts/build-pages.mjs
 *
 * Produit : index.html (français), en/index.html (anglais) et lumirift/index.html.
 * La feuille css/style.css est copiée dans chaque page (1.8.1) : relancez ce script après l'avoir modifiée.
 * Aucune dépendance : Node 18 ou plus suffit.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { messages, lumiriftPage } from '../js/i18n/messages.js';
import { config } from '../js/config.js';
import { minifyCss, purgeCss, pageNames } from './css.mjs';
import { afterFirstPaintScript } from './after-first-paint.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://adamrodwebdev.com';

/** Les polices du site (Google Fonts), demandées une fois le premier affichage signalé. */
const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Rajdhani:wght@500;600;700&display=swap';

/** La feuille du site, minifiée : entière dans l'accueil (ses îlots Vue s'en servent), réduite ailleurs. */
const siteCss = minifyCss(await readFile(join(ROOT, 'css/style.css'), 'utf8'));
/** Repère de la feuille dans une page rendue, remplacé une fois la page connue. */
const CSS_SLOT = '\u0000css\u0000';

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

/**
 * Les modules qu'importent `roots`, de proche en proche (racines comprises) : seulement les imports
 * statiques (un import() dynamique, comme la bande-son, reste chargé à la demande). Les noms nus
 * passent par l'import map.
 */
async function moduleGraph(roots, imports) {
  const found = new Set();
  const visit = async (url) => {
    if (found.has(url)) return;
    found.add(url);
    if (!url.startsWith('/')) return;
    const source = await readFile(join(ROOT, url), 'utf8');
    for (const [, specifier] of source.matchAll(/^\s*import\s+(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]/gm)) {
      if (!/^\.{0,2}\//.test(specifier) && !(specifier in imports)) throw new Error(`Absent de l'import map : ${specifier} (${url})`);
      await visit(imports[specifier] ?? new URL(specifier, ORIGIN + url).pathname);
    }
  };
  for (const root of roots) await visit(root);
  return [...found];
}

const template = await readFile(join(ROOT, 'templates/index.html'), 'utf8');
const { imports } = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(template)[1]);
// L'accueil : main.js lance les effets, puis importe les îlots Vue (islands.js) ; tous leurs modules
// sont préchargés d'un coup, avec les polices, une fois le premier affichage signalé.
const ENTRY = '/js/main.js';
const ISLANDS = '/js/islands.js';
const homeModules = (await moduleGraph([ENTRY, ISLANDS], imports)).filter((url) => url !== ENTRY);
const homeLoader = afterFirstPaintScript({ stylesheets: [FONTS], modules: homeModules, entry: ENTRY });

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
    fonts: FONTS,
    css: siteCss,
    afterFirstPaint: homeLoader,
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
  // Unbounded, la police du titre du jeu, réduite par Google Fonts aux lettres du titre.
  titleFont: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@900&text=LUMIRFTBOCKS&display=swap',
  // Le clip du lundi 2 novembre (la fabrique de clips du jeu, 1.39) : 7 s qui bouclent sans couture,
  // son affiche à 0,47 s. Mis en ligne le 29 octobre à 10 h 08, heure de Paris : une date et une heure
  // avec leur fuseau, comme Google l'attend pour uploadDate.
  clipDate: '2026-10-29T10:08:00+01:00',
  clipDuration: 'PT7S',
  posterTime: '0.467',
  // Classes que le script de la page ajoute lui-même : leurs règles restent dans la feuille copiée.
  runtimeClasses: ['is-dark', 'is-playing'],
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
    fonts: FONTS,
    titleFont: LUMIRIFT.titleFont,
    clipDate: LUMIRIFT.clipDate,
    clipDuration: LUMIRIFT.clipDuration,
    posterTime: LUMIRIFT.posterTime,
    // Une colonne sur téléphone, deux puis trois ensuite (la grille des cartes, 18rem au moins).
    cardSizes: '(width >= 64rem) 23rem, (width >= 41rem) calc(50vw - 3rem), calc(100vw - 2rem)',
    css: CSS_SLOT,
    afterFirstPaint: afterFirstPaintScript({ stylesheets: [FONTS, LUMIRIFT.titleFont] }),
    ...LUMIRIFT.social,
  },
  'lumirift',
);
// Sans îlot Vue, la page ne garde de la feuille du site que les règles que son HTML peut appliquer.
const lumiriftCss = purgeCss(siteCss, pageNames(lumirift, LUMIRIFT.runtimeClasses), lumirift);
const target = join(ROOT, LUMIRIFT.out);
await mkdir(dirname(target), { recursive: true });
await writeFile(target, lumirift.replace(CSS_SLOT, () => lumiriftCss));
console.log(`✔ ${LUMIRIFT.out}`);
