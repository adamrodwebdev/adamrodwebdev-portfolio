/**
 * Vue et vue-i18n servis par le site (1.9.0), plus par jsDelivr : copiés de node_modules, à la version
 * figée dans package.json et package-lock.json (npm vérifie leur empreinte à l'installation).
 * La version entre dans le nom du fichier : il peut rester un an dans le cache des visiteurs.
 *
 *  - Vue : la version d'exécution seule, les gabarits étant précompilés (scripts/vue-templates.mjs) ;
 *  - vue-i18n : la version complète, dont le compilateur de messages interprète sans `new Function`.
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const VENDORS = [
  { name: 'vue', file: 'dist/vue.runtime.esm-browser.prod.js' },
  { name: 'vue-i18n', file: 'dist/vue-i18n.esm-browser.prod.js' },
];

/**
 * Copie les bibliothèques dans `out`/vendor et renvoie l'import map de la page : { vue: '/vendor/vue-3.5.44.js', … }.
 */
export async function copyVendors(root, out) {
  await mkdir(join(out, 'vendor'), { recursive: true });
  const imports = {};
  for (const { name, file } of VENDORS) {
    const pkg = join(root, 'node_modules', name);
    const { version } = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'));
    const url = `/vendor/${name}-${version}.js`;
    await copyFile(join(pkg, file), join(out, url));
    imports[name] = url;
  }
  return imports;
}
