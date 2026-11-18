/**
 * La licence des polices Ressac en HTML (1.18.0). Ses fichiers Markdown (templates/ressac/EULA.<langue>.md,
 * copies exactes de la fonderie) n'emploient qu'une petite partie de Markdown, et ce module ne lit qu'elle :
 *
 *  - un titre # (la licence), puis sa ligne de version, puis l'introduction ;
 *  - des titres ## : un article (« 5. Licence web ») ou une partie (« Annexe A : … »), chacun avec son ancre ;
 *  - des paragraphes coupés à la ligne, des listes - et 1. avec leurs lignes de suite en retrait ;
 *  - des tableaux à barres verticales, avec leur ligne d'en-tête et leur ligne de tirets ;
 *  - **gras** et `code` dans le texte ; les adresses https et e-mail deviennent des liens.
 *
 * Tout autre balisage (titre ###, lien [texte](adresse), citation >, HTML, italique…) arrête la génération :
 * mieux vaut refuser que publier un contrat mal rendu. Le texte n'est jamais modifié, seulement balisé et échappé.
 */
import { escape } from './html.mjs';

const HEADING = /^(#+) (.+)$/;
const BULLET = /^- (.+)$/;
const NUMBERED = /^(\d+)\. (.+)$/;
const CONTINUATION = /^ {2,4}\S/;
const TABLE_ROW = /^\|.*\|$/;
const TABLE_RULE = /^\|(?::?-{3,}:?\|)+$/;
/** Ce que ce lecteur ne sait pas rendre, en début de ligne : citation, HTML, puce * ou +, bloc de code. */
const UNSUPPORTED_LINE = /^\s*(?:>|<|\* |\+ |```|~~~)/;
/** Les adresses web et e-mail du texte, rendues en liens (sans la ponctuation qui les suit). */
const AUTOLINK = /\bhttps:\/\/[^\s<]*[^\s<.,;:!?)]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/** Un identifiant d'ancre : minuscules sans accents, mots reliés par des tirets. */
export const slug = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Une ligne de texte en HTML : échappée, puis **gras**, `code` et liens. */
export function inline(text) {
  if (text.includes('](')) throw new Error(`Lien Markdown non pris en charge : « ${text} »`);
  return text.split(/(`[^`]+`)/).map((part, index) => {
    if (index % 2) return `<code>${escape(part.slice(1, -1))}</code>`;
    if (part.includes('`')) throw new Error(`Accent grave sans fin : « ${text} »`);
    const html = escape(part).replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>');
    if (html.includes('*')) throw new Error(`Emphase non prise en charge : « ${text} »`);
    return html.replace(AUTOLINK, (address) =>
      `<a href="${address.startsWith('https://') ? address : `mailto:${address}`}">${address}</a>`);
  }).join('');
}

/** Les cellules d'une ligne de tableau. */
const cells = (row) => row.slice(1, -1).split('|').map((cell) => cell.trim());

/** Les blocs du texte, dans l'ordre : titres, paragraphes, listes, tableaux. */
export function parseBlocks(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const startsBlock = (line) => HEADING.test(line) || TABLE_ROW.test(line) || BULLET.test(line) || NUMBERED.test(line);
  const refuse = (index, what) => { throw new Error(`${what}, ligne ${index + 1} : « ${lines[index]} »`); };
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    if (UNSUPPORTED_LINE.test(line)) refuse(i, 'Balisage non pris en charge');
    const heading = HEADING.exec(line);
    if (heading) {
      if (heading[1].length > 2) refuse(i, `Titre de niveau ${heading[1].length} non pris en charge`);
      blocks.push({ type: heading[1].length === 1 ? 'title' : 'heading', text: heading[2].trim() });
      i += 1;
    } else if (TABLE_ROW.test(line)) {
      const start = i;
      const rows = [];
      while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(lines[i++]);
      if (rows.length < 3 || !TABLE_RULE.test(rows[1].replace(/\s+/g, ''))) refuse(start, 'Tableau sans en-tête, ligne de tirets et contenu');
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      if (body.some((row) => row.length !== head.length)) refuse(start, 'Tableau aux lignes inégales');
      blocks.push({ type: 'table', head, body });
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const item = (ordered ? NUMBERED : BULLET).exec(lines[i]);
        if (item) {
          // Les numéros se suivent (1, 2, 3…) : ils servent d'ancres (article-10-4)
          if (ordered && item[1] !== String(items.length + 1)) refuse(i, 'Liste numérotée hors d\'ordre');
          items.push(ordered ? item[2] : item[1]);
        } else if (CONTINUATION.test(lines[i]) && !UNSUPPORTED_LINE.test(lines[i])) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
        } else {
          refuse(i, 'Ligne inattendue dans une liste');
        }
        i += 1;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
    } else {
      const text = [];
      while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
        if (UNSUPPORTED_LINE.test(lines[i])) refuse(i, 'Balisage non pris en charge');
        text.push(lines[i].trim());
        i += 1;
      }
      blocks.push({ type: 'p', text: text.join(' ') });
    }
  }
  return blocks;
}

/** Le HTML de chaque sorte de bloc, dans sa partie (`section` : son ancre, ou null pour l'introduction). */
const BLOCK_HTML = {
  p: (block) => `<p>${inline(block.text)}</p>`,
  ul: (block) => `<ul>\n${block.items.map((item) => `  <li>${inline(item)}</li>`).join('\n')}\n</ul>`,
  ol: (block, section) => `<ol>\n${block.items.map((item, index) =>
    `  <li${section ? ` id="${section}-${index + 1}"` : ''}>${inline(item)}</li>`).join('\n')}\n</ol>`,
  table: (block, section) => {
    // Un tableau large défile dans son cadre, jamais la page : au clavier aussi (tabindex), nommé par son titre.
    // Au-delà de trois colonnes, il garde une largeur où chaque colonne se lit (licence__table--wide).
    const frame = section ? ` role="region" aria-labelledby="${section}" tabindex="0"` : '';
    const wide = block.head.length > 3 ? ' licence__table--wide' : '';
    const head = block.head.map((cell) => `<th scope="col">${inline(cell)}</th>`).join('');
    const body = block.body.map((row) => `    <tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('\n');
    return `<div class="licence__table${wide}"${frame}>\n<table>\n  <thead><tr>${head}</tr></thead>\n  <tbody>\n${body}\n  </tbody>\n</table>\n</div>`;
  },
};

/**
 * La licence prête à placer dans la page : son titre, sa ligne de version, son introduction et ses parties.
 * @param {string} markdown le texte d'un fichier EULA.<langue>.md
 * @param {{ anchor: string }} options préfixe des ancres d'articles (« article » : #article-5, « section » : #section-5)
 * @returns {{ title: string, version: string, intro: string, sections: { id: string, title: string, html: string }[] }}
 */
export function renderLicence(markdown, { anchor }) {
  const [title, version, ...rest] = parseBlocks(markdown);
  if (title?.type !== 'title') throw new Error('La licence doit commencer par son titre (#)');
  if (version?.type !== 'p' || !/^Version \d/.test(version.text)) throw new Error('La ligne de version doit suivre le titre');
  const intro = [];
  const sections = [];
  for (const block of rest) {
    if (block.type === 'title') throw new Error(`Un seul titre # par licence : « ${block.text} »`);
    if (block.type === 'heading') {
      const number = /^(\d+)\. /.exec(block.text)?.[1];
      const id = number ? `${anchor}-${number}` : slug(block.text.split(':')[0]);
      if (!id || sections.some((section) => section.id === id)) throw new Error(`Ancre vide ou en double : « ${block.text} »`);
      sections.push({ id, title: inline(block.text), blocks: [] });
    } else if (sections.length) {
      sections[sections.length - 1].blocks.push(block);
    } else {
      intro.push(block);
    }
  }
  if (!sections.length) throw new Error('La licence n\'a aucun article (##)');
  return {
    title: inline(title.text),
    version: inline(version.text),
    intro: intro.map((block) => BLOCK_HTML[block.type](block, null)).join('\n'),
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      html: section.blocks.map((block) => BLOCK_HTML[block.type](block, section.id)).join('\n'),
    })),
  };
}
