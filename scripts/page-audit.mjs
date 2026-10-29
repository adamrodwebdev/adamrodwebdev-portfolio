/**
 * Contrôle des fichiers publiés (1.9.0), avant l'écriture de la CSP :
 *
 *  - l'empreinte SHA-256 de chaque <script> et <style> en ligne, que la CSP autorise un par un ;
 *  - aucun attribut style="…" ni gestionnaire on…="…" : la CSP les bloquerait (pas d'`unsafe-inline`) ;
 *  - aucune ressource d'un autre domaine (script, feuille, police, image, préconnexion, import) :
 *    le site ne fait aucune requête ailleurs que chez lui. Les liens <a href> restent libres.
 *
 * Un contrôle sur le texte, sans analyseur HTML : il suffit aux pages de ce dépôt. Le test Playwright
 * (tests/site.spec.mjs) vérifie le même résultat dans un vrai navigateur.
 */
import { createHash } from 'node:crypto';

const sha256 = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;

/** Une adresse absolue vers un autre site que `origin` (https://…, http://… ou //…). */
const isThirdParty = (url, origin) => /^(?:https?:)?\/\//i.test(url.trim()) && !url.trim().startsWith(`${origin}/`);

const attr = (tag, name) => new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'is').exec(tag)?.[2];

/** Les adresses qu'une feuille de style ou un bloc <style> demande (url(…), @import). */
const cssUrls = (css) => [...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)|@import\s+(['"])(.*?)\3/gi)].map((m) => m[2] ?? m[4]);

/** Les modules qu'un script importe ou les adresses qu'il appelle par fetch. */
const scriptUrls = (js) => [...js.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bfetch\s*\(\s*)(['"`])(.*?)\1/g)].map((m) => m[2]);

/**
 * Contrôle une page HTML.
 * @returns {{ scripts: string[], styles: string[], problems: string[] }} empreintes et problèmes trouvés
 */
export function auditPage(html, origin) {
  const scripts = [];
  const styles = [];
  const problems = [];
  const report = (message) => problems.push(message);

  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const type = attr(attrs, 'type')?.toLowerCase();
    if (attr(attrs, 'src') !== undefined) continue;
    if (type === 'application/ld+json') continue; // données, jamais exécutées : hors CSP
    scripts.push(sha256(body));
    if (type === 'importmap') {
      for (const url of Object.values(JSON.parse(body).imports ?? {})) if (isThirdParty(url, origin)) report(`import map : ${url}`);
      continue;
    }
    for (const url of [...scriptUrls(body), ...(body.match(/["'](?:https?:)?\/\/[^"']+["']/g) ?? []).map((s) => s.slice(1, -1))]) {
      if (isThirdParty(url, origin)) report(`script en ligne : ${url}`);
    }
  }

  for (const [, body] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    styles.push(sha256(body));
    for (const url of cssUrls(body)) if (isThirdParty(url, origin)) report(`style en ligne : ${url}`);
  }

  // Sans les blocs déjà vus : un attribut se lit dans les balises du document seulement.
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const [tag, name] of markup.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)) {
    if (/\sstyle\s*=/i.test(tag)) report(`attribut style : ${tag.slice(0, 80)}`);
    const handler = /\s(on[a-z]+)\s*=/i.exec(tag);
    if (handler) report(`gestionnaire ${handler[1]} : ${tag.slice(0, 80)}`);

    const element = name.toLowerCase();
    if (element === 'a' || element === 'meta' || element === 'form') continue;
    if (element === 'link' && /^(canonical|alternate)$/i.test(attr(tag, 'rel') ?? '')) continue;
    const urls = ['src', 'href', 'poster', 'data'].map((n) => attr(tag, n))
      .concat((attr(tag, 'srcset') ?? '').split(',').map((part) => part.trim().split(/\s+/)[0]))
      .filter(Boolean);
    for (const url of urls) if (isThirdParty(url, origin)) report(`<${element}> : ${url}`);
  }

  return { scripts, styles, problems };
}

/**
 * Contrôle une feuille de style ou un module publié : aucune adresse d'un autre domaine à charger et,
 * dans un module, aucun balisage avec attribut style (inséré par innerHTML ou v-html, la CSP le bloquerait).
 * Les gabarits des composants, précompilés dans dist/, n'en contiennent plus : Vue y applique les styles par le CSSOM.
 */
export function auditAsset(text, kind, origin) {
  const urls = kind === 'css' ? cssUrls(text) : scriptUrls(text);
  const problems = urls.filter((url) => isThirdParty(url, origin)).map((url) => `${kind} : ${url}`);
  if (kind === 'js') {
    for (const [tag] of text.matchAll(/<[a-z][\w-]*\s[^<>]*?\bstyle\s*=[^<>]*>/gi)) problems.push(`balisage avec attribut style : ${tag.slice(0, 80)}`);
  }
  return problems;
}
