/**
 * Ce que le site publie (1.9.0) : la génération copie cette liste dans dist/, que Netlify sert.
 * Tout le reste du dépôt (README, CHANGELOG, ROADMAP, package*.json, templates/, scripts/,
 * node_modules/, fichiers cachés) n'y entre jamais : aucune adresse ne peut le servir.
 */
import { cp, rm, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

/** Fichiers et dossiers publiés, à la racine du dépôt. Les pages générées s'y ajoutent ensuite. */
export const PUBLIC_ENTRIES = [
  '404.html', 'merci.html', 'mentions-legales.html',
  'manifest.webmanifest', 'robots.txt', 'sitemap.xml',
  'assets', 'css', 'fonts', 'js', 'en', 'lumirift',
];

/** Jamais copiés, même dans un dossier publié : fichiers cachés et notes en Markdown. */
const isPrivate = (path) => basename(path).startsWith('.') || path.endsWith('.md');

/** Vide `out`, puis y copie les fichiers publiés de `root`. */
export async function copySite(root, out) {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const entry of PUBLIC_ENTRIES) {
    await cp(join(root, entry), join(out, entry), { recursive: true, filter: (path) => !isPrivate(path) });
  }
}
