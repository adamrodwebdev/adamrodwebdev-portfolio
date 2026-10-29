/**
 * La feuille de style du site, préparée pour être copiée dans les pages générées (1.8.1) :
 * aucune feuille externe ne retient le premier affichage.
 *
 *  - minifyCss : sans commentaires ni espaces inutiles (les chaînes restent intactes) ;
 *  - purgeCss  : pour une page sans îlot Vue, seulement les règles que son HTML peut appliquer.
 *
 * Aucune dépendance. Ce n'est pas un analyseur CSS complet : il suffit à css/style.css (règles,
 * @media, @supports, @keyframes) et reste prudent, car une règle gardée en trop ne coûte que quelques octets.
 */

/** Découpe le texte en morceaux de code et en chaînes ('…' ou "…"), commentaires retirés. */
function tokens(css) {
  const parts = [];
  let code = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 1;
      code += ' ';
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) j += css[j] === '\\' ? 2 : 1;
      parts.push({ code }, { string: css.slice(i, j + 1) });
      code = '';
      i = j;
    } else {
      code += c;
    }
  }
  parts.push({ code });
  return parts;
}

/** Retire commentaires et espaces superflus. */
export function minifyCss(css) {
  return tokens(css)
    .map((part) => part.string ?? part.code
      .replace(/\s+/g, ' ')
      .replace(/ ?([{};]) ?/g, '$1')
      .replace(/([,:]) /g, '$1')
      .replace(/;}/g, '}'))
    .join('')
    .trim();
}

/** Coupe `text` sur `separator` hors parenthèses, crochets et chaînes. */
function splitTop(text, separator) {
  const out = [];
  let depth = 0, quote = '', start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === separator && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out;
}

/** Les blocs de premier niveau d'une feuille minifiée : { prelude, body } (body vaut null pour une instruction). */
function blocks(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    let quote = '', depth = 0, j = i;
    for (; j < css.length; j++) {
      const c = css[j];
      if (quote) { if (c === '\\') j++; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
      else if ((c === '{' || c === ';') && depth === 0) break;
    }
    const prelude = css.slice(i, j).trim();
    if (css[j] !== '{') { if (prelude) out.push({ prelude, body: null }); i = j + 1; continue; }
    let level = 1, k = j + 1;
    for (; k < css.length && level > 0; k++) {
      const c = css[k];
      if (quote) { if (c === '\\') k++; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === '{') level++;
      else if (c === '}') level--;
    }
    out.push({ prelude, body: css.slice(j + 1, k - 1) });
    i = k;
  }
  return out;
}

/** Les classes et identifiants présents dans le HTML d'une page. */
export function pageNames(html, runtimeClasses = []) {
  const classes = new Set(runtimeClasses);
  const ids = new Set();
  for (const [, value] of html.matchAll(/\sclass="([^"]*)"/g)) value.split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
  for (const [, value] of html.matchAll(/\sid="([^"]*)"/g)) ids.add(value);
  return { classes, ids };
}

/**
 * Un sélecteur peut s'appliquer si chacune de ses classes et chacun de ses identifiants existent dans la page.
 * Les éléments, attributs et pseudo-classes ne décident de rien, :not() :has() :is() :where() non plus.
 */
function canMatch(selector, names) {
  const bare = selector
    .replace(/\[[^\]]*\]/g, '')
    .replace(/:(?:not|has|is|where)\((?:[^()]|\([^()]*\))*\)/g, '');
  const classes = bare.match(/\.-?[_a-zA-Z][\w-]*/g) || [];
  const ids = bare.match(/#-?[_a-zA-Z][\w-]*/g) || [];
  return classes.every((c) => names.classes.has(c.slice(1))) && ids.every((id) => names.ids.has(id.slice(1)));
}

const GROUPING = /^@(?:media|supports|container|layer)\b/;

function keepMatching(css, names) {
  return blocks(css).map(({ prelude, body }) => {
    if (body === null) return `${prelude};`;
    if (GROUPING.test(prelude)) {
      const inner = keepMatching(body, names);
      return inner ? `${prelude}{${inner}}` : '';
    }
    if (prelude.startsWith('@')) return `${prelude}{${body}}`;
    const selectors = splitTop(prelude, ',').filter((s) => canMatch(s, names));
    return selectors.length ? `${selectors.join(',')}{${body}}` : '';
  }).join('');
}

function dropUnusedKeyframes(css, used) {
  return blocks(css).map(({ prelude, body }) => {
    if (body === null) return `${prelude};`;
    const keyframes = /^@(?:-webkit-)?keyframes\s+(\S+)/.exec(prelude);
    if (keyframes) return used.has(keyframes[1]) ? `${prelude}{${body}}` : '';
    if (GROUPING.test(prelude)) {
      const inner = dropUnusedKeyframes(body, used);
      return inner ? `${prelude}{${inner}}` : '';
    }
    return `${prelude}{${body}}`;
  }).join('');
}

/**
 * Ne garde, d'une feuille minifiée, que les règles que la page peut appliquer, et les animations
 * qu'elles nomment ou que nomme la page elle-même (`html` : ses styles en ligne).
 */
export function purgeCss(css, names, html = '') {
  const kept = keepMatching(css, names);
  const used = new Set();
  for (const [, value] of (kept + html).matchAll(/animation(?:-name)?\s*:([^;}"]*)/g)) {
    (value.match(/[-\w]+/g) || []).forEach((word) => used.add(word));
  }
  return dropUnusedKeyframes(kept, used);
}
