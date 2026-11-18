/**
 * La licence des polices Ressac (1.18.0), en français et en anglais : la page qu'ouvre la case « Conditions »
 * du paiement Gumroad. Générée par scripts/build-pages.mjs à partir de templates/ressac/licence.html.
 *
 * Le texte vient mot pour mot du dépôt de la fonderie (type-foundry, privé) : templates/ressac/EULA.fr.md et
 * EULA.en.md en sont des copies exactes, au commit de LICENCE_SOURCE. La génération vérifie chaque copie par
 * son identifiant Git : un texte retouché ici, sans sa source, l'arrête.
 *
 * Mettre la licence à jour : recopier les deux fichiers depuis type-foundry
 *   git -C ../type-foundry show <commit>:licence/EULA.fr.md > templates/ressac/EULA.fr.md   (et EULA.en.md)
 * puis reporter le commit et les identifiants (git -C ../type-foundry rev-parse <commit>:licence/EULA.fr.md)
 * dans LICENCE_SOURCE ci-dessous.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { messages, licencePage } from '../js/i18n/messages.js';
import { languageOf } from '../js/i18n/languages.js';
import { renderLicence } from './licence-markdown.mjs';
import { CSS_SLOT, render, writePage } from './template.mjs';
import { purgeCss, pageNames } from './css.mjs';
import { afterFirstPaintScript } from './after-first-paint.mjs';

/** D'où vient le texte : le dépôt de la fonderie, au commit de la version 1.0 en vigueur (CM2C signé le 18 novembre 2026). */
export const LICENCE_SOURCE = {
  repository: 'type-foundry',
  commit: 'df793663f079bda32cdd6e07761efbc45ae84928',
  committed: '2026-11-18',
};

/**
 * Les deux pages : la française prévaut (article 17), l'anglaise sert aussi les autres langues (x-default).
 *  - copy : la copie dans ce dépôt ; from : le fichier source dans type-foundry ; blob : son identifiant Git
 *    au commit de LICENCE_SOURCE ;
 *  - anchor : le préfixe des ancres d'articles, dans la langue du texte (#article-5, #section-5) ;
 *  - tocId : l'ancre du sommaire.
 */
export const LICENCE_PAGES = [
  {
    code: 'fr', path: '/ressac/licence/', anchor: 'article', tocId: 'sommaire',
    copy: 'templates/ressac/EULA.fr.md', from: 'licence/EULA.fr.md', blob: '1841a21ff6adebe865cef8551f6643f3bcc4bbd5',
  },
  {
    code: 'en', path: '/en/ressac/licence/', anchor: 'section', tocId: 'contents',
    copy: 'templates/ressac/EULA.en.md', from: 'licence/EULA.en.md', blob: 'c3fa9a25ed4467fe75af6d33059d66f8ea5b59bd',
  },
];

/** L'identifiant Git d'un texte (sha1 de « blob <taille>\0<contenu> »), avec les fins de ligne LF du dépôt. */
export function gitBlobId(text) {
  const bytes = Buffer.from(text.replace(/\r\n?/g, '\n'), 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

/** Le texte d'une page, refusé s'il n'est plus la copie exacte de sa source. */
export async function readLicence(root, page) {
  const text = await readFile(join(root, page.copy), 'utf8');
  if (gitBlobId(text) !== page.blob) {
    throw new Error(`${page.copy} n'est plus la copie de ${page.from} au commit ${LICENCE_SOURCE.commit.slice(0, 7)} `
      + `de ${LICENCE_SOURCE.repository} : recopiez le fichier source et mettez LICENCE_SOURCE à jour (scripts/licence-pages.mjs).`);
  }
  return text;
}

/** Les liens alternatifs, les mêmes sur les deux pages : français, anglais, et l'anglais pour les autres langues. */
const alternates = (origin) => [
  ...LICENCE_PAGES.map((page) => `<link rel="alternate" hreflang="${page.code}" href="${origin}${page.path}">`),
  `<link rel="alternate" hreflang="x-default" href="${origin}${LICENCE_PAGES[1].path}">`,
].join('\n  ');

/**
 * Écrit les deux pages dans `out` (dist/).
 * @param {{ root: string, out: string, origin: string, siteCss: string, fonts: string }} build sources, dossier
 *   publié, adresse du site, feuille du site minifiée (réduite ici à ce que la page emploie), feuille des polices
 */
export async function buildLicencePages({ root, out, origin, siteCss, fonts }) {
  const template = await readFile(join(root, 'templates/ressac/licence.html'), 'utf8');
  for (const page of LICENCE_PAGES) {
    const other = LICENCE_PAGES.find((candidate) => candidate !== page);
    const language = languageOf(page.code);
    const licence = renderLicence(await readLicence(root, page), { anchor: page.anchor });
    const html = render(
      template,
      { ...messages[page.code], licence: licencePage[page.code] },
      {
        lang: page.code,
        url: origin + page.path,
        alternates: alternates(origin),
        home: language.base,
        legal: language.legal,
        otherUrl: other.path,
        otherLang: other.code,
        otherCode: other.code.toUpperCase(),
        tocId: page.tocId,
        title: licence.title,
        version: licence.version,
        intro: licence.intro,
        toc: licence.sections.map((section) => `<li><a href="#${section.id}">${section.title}</a></li>`).join('\n            '),
        sections: licence.sections.map((section) =>
          `<section aria-labelledby="${section.id}">\n<h2 id="${section.id}">${section.title}</h2>\n${section.html}\n</section>`).join('\n'),
        fonts,
        css: CSS_SLOT,
        afterFirstPaint: afterFirstPaintScript({ stylesheets: [fonts] }),
      },
      `licence.${page.code}`,
    );
    // Sans îlot Vue, la page ne garde de la feuille du site que les règles que son HTML peut appliquer.
    const css = purgeCss(siteCss, pageNames(html), html);
    await writePage(out, `${page.path.slice(1)}index.html`, html.replace(CSS_SLOT, () => css));
  }
}
