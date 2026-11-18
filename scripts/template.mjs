/**
 * Les gabarits des pages générées (sortis de scripts/build-pages.mjs en 1.18.0, pour la licence Ressac) :
 * remplir un gabarit, puis écrire la page dans dist/.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { escape } from './html.mjs';

/** Repère de la feuille dans une page rendue, remplacé une fois la page connue (sa feuille réduite en dépend). */
export const CSS_SLOT = '\u0000css\u0000';

const lookup = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/**
 * Remplit un gabarit : [[clé]] lit un texte de `texts` (échappé), [[@nom]] une valeur calculée.
 * Les messages vue-i18n peuvent contenir {param} : ils ne doivent pas apparaître dans les pages statiques.
 */
export function render(template, texts, special, where) {
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

/** Écrit une page générée dans `out`, ses dossiers compris. */
export async function writePage(out, file, html) {
  const target = join(out, file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
  console.log(`✔ ${file}`);
}
