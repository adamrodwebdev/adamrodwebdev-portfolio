/**
 * Gabarits des composants Vue précompilés à la génération (1.9.0).
 *
 * Dans js/components/, chaque composant garde son gabarit lisible (`template: `…``). Dans dist/, ce gabarit
 * devient une fonction de rendu, compilée par la même version de Vue que celle servie au navigateur.
 * Le navigateur n'a plus rien à compiler : la version d'exécution seule de Vue suffit, et la CSP
 * n'autorise pas `unsafe-eval` (Vue compilait les gabarits avec `new Function`).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileTemplate } from 'vue/compiler-sfc';

const TEMPLATE = /\btemplate:\s*`/;

/** Remplace le gabarit d'un composant par sa fonction de rendu ; un fichier sans gabarit reste tel quel. */
export function precompileComponent(source, filename) {
  const start = source.search(TEMPLATE);
  if (start < 0) return source;
  const open = source.indexOf('`', start);
  const close = source.indexOf('`', open + 1);
  const template = source.slice(open + 1, close);
  if (/\$\{|\\/.test(template)) throw new Error(`${filename} : un gabarit ne doit contenir ni \${…} ni \\ (il est lu tel quel).`);

  const { code, errors } = compileTemplate({
    source: template,
    filename,
    id: filename,
    isProd: true,
    compilerOptions: { mode: 'module' },
  });
  if (errors.length) throw new Error(`${filename} :\n${errors.map(String).join('\n')}`);

  // Les déclarations import se placent n'importe où au premier niveau d'un module, et la fonction
  // de rendu, déclarée en fin de fichier, est remontée : le composant la référence avant sa déclaration.
  const render = code.replace(/^export function render\(/m, 'function render(');
  return `${source.slice(0, start)}render${source.slice(close + 1)}\n// Gabarit précompilé (scripts/vue-templates.mjs)\n${render}\n`;
}

/** Précompile les composants de `dir` sur place (dans dist/, jamais dans les sources). */
export async function precompileComponents(dir) {
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.js')) continue;
    const file = join(dir, name);
    await writeFile(file, precompileComponent(await readFile(file, 'utf8'), name));
  }
}
