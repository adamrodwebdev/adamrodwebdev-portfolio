/**
 * Génère le site publié dans dist/ (1.9.0), le dossier que Netlify sert.
 *
 *   npm run build      (après npm ci : Vue, vue-i18n et leur compilateur viennent de node_modules)
 *
 *  1. copie les fichiers publiés (scripts/site-files.mjs) : rien d'autre du dépôt n'est servi ;
 *  2. copie Vue et vue-i18n à leur version figée (scripts/vendor.mjs) ;
 *  3. précompile les gabarits des composants Vue (scripts/vue-templates.mjs) ;
 *  4. génère les pages traduites et la page de Lumirift (scripts/build-pages.mjs) ;
 *  5. contrôle chaque fichier publié et écrit les en-têtes, CSP comprise, dans dist/_headers
 *     (scripts/page-audit.mjs, scripts/headers.mjs). Un problème arrête la génération.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copySite } from './site-files.mjs';
import { copyVendors } from './vendor.mjs';
import { precompileComponents } from './vue-templates.mjs';
import { buildPages, ORIGIN } from './build-pages.mjs';
import { auditPage, auditAsset } from './page-audit.mjs';
import { contentSecurityPolicy, headersFile } from './headers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');

/** Tous les fichiers d'un dossier, de proche en proche. */
async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
}

await copySite(ROOT, OUT);
const imports = await copyVendors(ROOT, OUT);
await precompileComponents(join(OUT, 'js/components'));
await buildPages({ root: ROOT, out: OUT, imports });

const scripts = new Set();
const styles = new Set();
const problems = [];
for (const file of await filesIn(OUT)) {
  const name = relative(OUT, file).replaceAll('\\', '/');
  const kind = /\.(html|css|js)$/.exec(name)?.[1];
  if (!kind || name.startsWith('vendor/')) continue;
  const text = await readFile(file, 'utf8');
  if (kind === 'html') {
    const audit = auditPage(text, ORIGIN);
    audit.scripts.forEach((hash) => scripts.add(hash));
    audit.styles.forEach((hash) => styles.add(hash));
    problems.push(...audit.problems.map((problem) => `${name} : ${problem}`));
  } else {
    problems.push(...auditAsset(text, kind, ORIGIN).map((problem) => `${name} : ${problem}`));
  }
}
if (problems.length) {
  console.error(`✘ ${problems.length} problème(s) :\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

await writeFile(join(OUT, '_headers'), headersFile(contentSecurityPolicy({ scripts, styles })));
console.log(`✔ _headers (CSP : ${scripts.size} script(s) et ${styles.size} style(s) en ligne autorisés par empreinte)`);
