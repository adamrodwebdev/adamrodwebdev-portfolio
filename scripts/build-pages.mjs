/**
 * Génère les pages statiques traduites à partir de templates/index.html
 * et des traductions de js/i18n/messages.js (les mêmes que celles de vue-i18n),
 * puis la page du jeu Lumirift (templates/lumirift.html, en anglais seulement).
 * Appelé par scripts/build.mjs, une fois dist/ préparé (fichiers publiés, Vue, gabarits précompilés).
 *
 * Produit, dans dist/ : un accueil par langue de js/i18n/languages.js (index.html en français,
 * en/, ru/, it/, es/…) et lumirift/index.html.
 * La feuille css/style.css est copiée dans chaque page (1.8.1).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { messages, lumiriftPage } from '../js/i18n/messages.js';
import { LANGUAGES, DEFAULT_LANGUAGE } from '../js/i18n/languages.js';
import { config } from '../js/config.js';
import { projects } from '../js/data/projects.js';
import { playLinks } from '../js/data/platforms.js';
import { SECTIONS, DURATION, TITLE, clock } from '../js/audio/score.js';
import { minifyCss, purgeCss, pageNames } from './css.mjs';
import { afterFirstPaintScript } from './after-first-paint.mjs';

export const ORIGIN = 'https://adamrodwebdev.com';

/** Les polices du site (css/fonts.css, fichiers dans fonts/), demandées une fois le premier affichage signalé. */
const FONTS = '/css/fonts.css';

/** La première plateforme où jouer à un jeu du carrousel (le contenu statique de l'accueil n'en cite qu'une). */
const playUrl = (id) => playLinks(projects.find((project) => project.id === id))[0].url;

/** Repère de la feuille dans une page rendue, remplacé une fois la page connue. */
const CSS_SLOT = '\u0000css\u0000';

/**
 * La section « Bande-son » sans JavaScript (1.12.0) : le morceau et ses cinq parties, les mêmes classes que le
 * lecteur Vue qui la remplace. La note « JavaScript requis » n'apparaît que si JavaScript manque.
 */
function soundtrackStatic(texts) {
  const st = texts.soundtrack;
  const chapters = SECTIONS.map((section, i) => {
    const chapter = st.chapters[section.key];
    return `<li class="chapter"><span class="chapter__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>`
      + `<div class="chapter__body"><h3 class="chapter__name">${escape(chapter.name)}</h3><p class="chapter__text">${escape(chapter.text)}</p></div>`
      + `<span class="chapter__play chapter__play--static"><time datetime="PT${Math.floor(section.start)}S">${clock(section.start)}</time></span></li>`;
  });
  return `<div class="soundtrack__grid">
            <div class="sound-deck">
              <div class="sound-deck__head"><span class="sound-deck__viz" aria-hidden="true"></span><div class="sound-deck__id"><p class="sound-deck__title">${escape(TITLE)}</p><p class="sound-deck__facts">${escape(st.facts.replace('{duration}', clock(DURATION)))}</p></div></div>
              <p class="sound-deck__note no-js-only">${escape(st.noscript)}</p>
            </div>
            <ol class="chapters" role="list" aria-label="${escape(st.chaptersLabel)}">${chapters.join('')}</ol>
            <p class="soundtrack__credits">${escape(st.credits)}</p>
          </div>`;
}

/** Les accueils à générer, un par langue : index.html pour la langue par défaut, <code>/index.html sinon. */
const pages = LANGUAGES.map((language) => ({ ...language, out: `${language.base.slice(1)}index.html` }));

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
 * Les modules qu'importent `roots`, de proche en proche (racines comprises), lus dans `dir` : seulement les
 * imports statiques (un import() dynamique, comme la bande-son, reste chargé à la demande). Les noms nus
 * passent par l'import map.
 */
async function moduleGraph(dir, roots, imports) {
  const found = new Set();
  const visit = async (url) => {
    if (found.has(url)) return;
    found.add(url);
    if (!url.startsWith('/') || url.startsWith('/vendor/')) return;
    const source = await readFile(join(dir, url), 'utf8');
    for (const [, specifier] of source.matchAll(/^\s*import\s+(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]/gm)) {
      if (!/^\.{0,2}\//.test(specifier) && !(specifier in imports)) throw new Error(`Absent de l'import map : ${specifier} (${url})`);
      await visit(imports[specifier] ?? new URL(specifier, ORIGIN + url).pathname);
    }
  };
  for (const root of roots) await visit(root);
  return [...found];
}

/**
 * La page du jeu Lumirift (1.8.0), l'adresse que donnent les réseaux : en anglais seulement,
 * avec l'en-tête et le pied de page anglais du site. Son clip et ses images sont dans lumirift/.
 */
const LUMIRIFT = {
  out: 'lumirift/index.html',
  url: `${ORIGIN}/lumirift/`,
  play: 'https://playgama.ai/play/be4bqnmqcv',
  // Le clip du lundi 2 novembre (la fabrique de clips du jeu), re-rendu le 1er novembre sur la 1.45 :
  // le puits de 10 × 18, les pièces d'un seul cristal, la constellation d'atterrissage. 7 s qui bouclent
  // sans couture, son affiche à 0,47 s. Recoupé le 1er novembre à 11 h 37, heure de Paris : une date et
  // une heure avec leur fuseau, comme Google l'attend pour uploadDate.
  clipDate: '2026-11-01T11:37:00+01:00',
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

/**
 * Le menu des langues de l'en-tête (1.10.0), tel qu'avant le montage de Vue : un <details> qui marche
 * sans JavaScript. Le code visible (FR, EN…) fait partie du nom accessible du bouton (WCAG 2.5.3).
 */
function languageMenu(current, label) {
  const items = pages.map((p) => `<li><a href="${p.base}" hreflang="${p.code}" lang="${p.code}"${p.code === current.code ? ' aria-current="true"' : ''}>${escape(p.name)}</a></li>`);
  return `<details class="lang-menu">
            <summary class="icon-btn lang-btn">${current.code.toUpperCase()}<span class="visually-hidden"> ${escape(label)}</span>
              <svg class="lang-menu__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>
            </summary>
            <ul class="lang-menu__list">
              ${items.join('\n              ')}
            </ul>
          </details>`;
}

async function writePage(out, file, html) {
  const target = join(out, file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
  console.log(`✔ ${file}`);
}

/**
 * Écrit les pages générées dans `out` (dist/).
 * @param {{ root: string, out: string, imports: Record<string, string> }} build sources, dossier publié, import map
 */
export async function buildPages({ root, out, imports }) {
  /** La feuille du site, minifiée : entière dans l'accueil (ses îlots Vue s'en servent), réduite ailleurs. */
  const siteCss = minifyCss(await readFile(join(root, 'css/style.css'), 'utf8'));

  // L'accueil : main.js lance les effets, puis importe les îlots Vue (islands.js) ; tous leurs modules
  // sont préchargés d'un coup, avec les polices, une fois le premier affichage signalé.
  const template = await readFile(join(root, 'templates/index.html'), 'utf8');
  const ENTRY = '/js/main.js';
  const ISLANDS = '/js/islands.js';
  const homeModules = (await moduleGraph(out, [ENTRY, ISLANDS], imports)).filter((url) => url !== ENTRY);

  for (const page of pages) {
    const locale = page.code;
    const others = pages.filter((other) => other.code !== locale);
    const m = messages[locale];
    // Ses seuls textes : préchargés avec les îlots, importés par js/i18n/index.js
    const loader = afterFirstPaintScript({ stylesheets: [FONTS], modules: [...homeModules, `/js/i18n/locales/${locale}.js`], entry: ENTRY });
    const special = {
      lang: locale,
      url: ORIGIN + page.base,
      origin: ORIGIN,
      alternates: [
        ...pages.map((p) => `<link rel="alternate" hreflang="${p.code}" href="${ORIGIN}${p.base}">`),
        `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${DEFAULT_LANGUAGE.base}">`,
      ].join('\n  '),
      ogAltLocales: others.map((p) => `<meta property="og:locale:alternate" content="${messages[p.code].meta.ogLocale}">`).join('\n  '),
      inLanguage: JSON.stringify(pages.map((p) => messages[p.code].meta.ldLanguage)),
      langMenu: languageMenu(page, m.nav.langMenu),
      footerLangs: others.map((p) => `<li><a href="${p.base}" hreflang="${p.code}" lang="${p.code}">${escape(p.name)}</a></li>`).join('\n          '),
      thanks: page.thanks,
      legal: page.legal,
      // Les mentions légales n'existent qu'en français et en anglais : le lien dit vers quelle langue il mène
      legalHreflang: page.legal.startsWith(page.base) ? '' : ' hreflang="en"',
      typeOptions: m.form.types.map((o) => `<option>${escape(o)}</option>`).join(''),
      budgetOptions: m.form.budgets.map((o) => `<option>${escape(o)}</option>`).join(''),
      sendLabel: escape(m.form.steps[0]),
      soundtrackStatic: soundtrackStatic(m),
      contactEmail: escape(config.contactEmail),
      playCatapulte: escape(playUrl('catapulte-mania')),
      playBastion: escape(playUrl('bastion')),
      importMap: JSON.stringify({ imports }),
      fonts: FONTS,
      css: siteCss,
      afterFirstPaint: loader,
    };
    await writePage(out, page.out, render(template, m, special, locale));
  }

  const lumirift = render(
    await readFile(join(root, 'templates/lumirift.html'), 'utf8'),
    { ...messages.en, page: lumiriftPage },
    {
      origin: ORIGIN,
      url: LUMIRIFT.url,
      play: LUMIRIFT.play,
      fonts: FONTS,
      clipDate: LUMIRIFT.clipDate,
      clipDuration: LUMIRIFT.clipDuration,
      posterTime: LUMIRIFT.posterTime,
      // Une colonne sur téléphone, deux puis trois ensuite (la grille des cartes, 18rem au moins).
      cardSizes: '(width >= 64rem) 23rem, (width >= 41rem) calc(50vw - 3rem), calc(100vw - 2rem)',
      css: CSS_SLOT,
      afterFirstPaint: afterFirstPaintScript({ stylesheets: [FONTS] }),
      ...LUMIRIFT.social,
    },
    'lumirift',
  );
  // Sans îlot Vue, la page ne garde de la feuille du site que les règles que son HTML peut appliquer.
  const lumiriftCss = purgeCss(siteCss, pageNames(lumirift, LUMIRIFT.runtimeClasses), lumirift);
  await writePage(out, LUMIRIFT.out, lumirift.replace(CSS_SLOT, () => lumiriftCss));
}
