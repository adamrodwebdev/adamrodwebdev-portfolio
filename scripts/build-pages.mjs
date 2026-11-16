/**
 * Génère les pages statiques traduites à partir de templates/index.html
 * et des traductions de js/i18n/messages.js (les mêmes que celles de vue-i18n),
 * puis la page du jeu Lumirift (templates/lumirift.html, en anglais seulement).
 * Appelé par scripts/build.mjs, une fois dist/ préparé (fichiers publiés, Vue, gabarits précompilés).
 *
 * Produit, dans dist/ : un accueil par langue de js/i18n/languages.js (index.html en français,
 * en/, ru/, it/, es/…), lumirift/index.html et la licence des polices Ressac en français et en anglais
 * (scripts/licence-pages.mjs, 1.18.0).
 * La feuille css/style.css est copiée dans chaque page (1.8.1).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { messages, lumiriftPage, learnPage } from '../js/i18n/messages.js';
import { LANGUAGES, DEFAULT_LANGUAGE, languageOf } from '../js/i18n/languages.js';
import { config } from '../js/config.js';
import { projects } from '../js/data/projects.js';
import { playLinks } from '../js/data/platforms.js';
import { SECTIONS, DURATION, TITLE, clock } from '../js/audio/score.js';
import { minifyCss, purgeCss, pageNames } from './css.mjs';
import { afterFirstPaintScript } from './after-first-paint.mjs';
import { escape } from './html.mjs';
import { offersPanel, testimonialsBlock, heroSecondCta, contactBooking, maltFact, ldOffers } from './offers.mjs';
import { CSS_SLOT, render, writePage } from './template.mjs';
import { buildLicencePages } from './licence-pages.mjs';

export const ORIGIN = 'https://adamrodwebdev.com';

/** Les polices du site (css/fonts.css, fichiers dans fonts/), demandées une fois le premier affichage signalé. */
const FONTS = '/css/fonts.css';

/** La première plateforme où jouer à un jeu du carrousel (le contenu statique de l'accueil n'en cite qu'une). */
const playUrl = (id) => playLinks(projects.find((project) => project.id === id))[0].url;

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
 * La série « Comment marche le Web » (1.14.0) : l'épisode 1, en français (/learn/) et en anglais
 * (/en/learn/) d'abord. Les autres langues mènent à la page anglaise tant que leur voix n'est pas
 * enregistrée : aucune page en anglais sous /it/ ou /ru/ (doublons, hreflang faux). Pas d'îlot Vue :
 * son module se charge après le premier affichage, comme les îlots de l'accueil.
 */
const LEARN = {
  languages: ['fr', 'en'],
  entry: '/js/learn/main.js',
  // La pastille de chaque battement prend la couleur de la ligne de métro qu'il emprunte (or : le serveur).
  beatColours: ['green', 'green', 'green', 'gold', 'red', ''],
  // Classes que le module de la page ajoute lui-même : leurs règles restent dans la feuille copiée.
  runtimeClasses: ['is-dark', 'is-ready', 'learn-film'],
};
const learnBase = (code) => `${languageOf(code).base}learn/`;

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
      // L'offre commerciale (1.17.0) : prix dans la langue de la page, blocs absents tant que leur donnée manque
      offersPanel: offersPanel(m, m.meta.ldLanguage),
      testimonials: testimonialsBlock(m, locale),
      heroSecondCta: heroSecondCta(m),
      contactBooking: contactBooking(m),
      maltFact: maltFact(m),
      ldOffers: ldOffers(m),
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

  // La licence des polices Ressac (1.18.0), en français et en anglais
  await buildLicencePages({ root, out, origin: ORIGIN, siteCss, fonts: FONTS });

  // « Comment marche le Web » : une page par langue enregistrée, ses modules préchargés après le premier affichage.
  const learnTemplate = await readFile(join(root, 'templates/learn.html'), 'utf8');
  const learnModules = (await moduleGraph(out, [LEARN.entry], imports)).filter((url) => url !== LEARN.entry);
  for (const code of LEARN.languages) {
    const page = learnPage[code];
    const language = languageOf(code);
    const other = LEARN.languages.find((candidate) => candidate !== code);
    const base = learnBase(code);
    const html = render(learnTemplate, { ...messages[code], page }, {
      lang: code,
      url: ORIGIN + base,
      alternates: [
        ...LEARN.languages.map((c) => `<link rel="alternate" hreflang="${c}" href="${ORIGIN}${learnBase(c)}">`),
        `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${learnBase(DEFAULT_LANGUAGE.code)}">`,
      ].join('\n  '),
      home: language.base,
      otherHref: learnBase(other),
      otherLang: other,
      otherCode: other.toUpperCase(),
      legal: language.legal,
      legalHreflang: language.legal.startsWith(language.base) ? '' : ' hreflang="en"',
      fonts: FONTS,
      css: CSS_SLOT,
      afterFirstPaint: afterFirstPaintScript({ stylesheets: [FONTS], modules: learnModules, entry: LEARN.entry }),
      dots: page.beats
        .map((name, i) => `<li><button class="learn-step${LEARN.beatColours[i] ? ` learn-step--${LEARN.beatColours[i]}` : ''}" type="button" data-learn-dot>${escape(name)}</button></li>`)
        .join('\n        '),
      narration: page.narration.map((line) => `<li>${escape(line)}</li>`).join('\n        '),
      glossary: page.glossary.map(([term, meaning]) => `<div><dt>${escape(term)}</dt><dd>${escape(meaning)}</dd></div>`).join('\n        '),
      captions: page.captions.map((caption) => `<li data-caption>${escape(caption)}</li>`).join('\n      '),
    }, `learn-${code}`);
    const css = purgeCss(siteCss, pageNames(html, LEARN.runtimeClasses), html);
    await writePage(out, `${base.slice(1)}index.html`, html.replace(CSS_SLOT, () => css));
  }
}
