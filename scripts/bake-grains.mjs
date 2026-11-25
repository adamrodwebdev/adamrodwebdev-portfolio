/**
 * Précalcule les grains du logo de la section « Bande-son » (1.21.0) : un Chromium sans écran échantillonne
 * la silhouette avec le module du site (js/fx/particle-silhouette.js), puis le fichier est écrit dans
 * assets/grains/. Le navigateur du visiteur n'échantillonne rien : cela coûtait de 150 à 590 ms au ralenti 4 ×.
 *
 * À relancer seulement quand le logo change : npm run bake:grains (le fichier est versionné, la génération
 * du site ne le refait pas, Netlify n'ayant pas de navigateur).
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { encodeGrains } from '../js/fx/grain-file.js';
import { EMBLEM_GRAINS } from '../js/fx/soundtrack-grains.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Le logo du site (l'hexagone et son A, comme dans l'en-tête), plein : l'hexagone dense, le A évidé. Un contour
 * de 2 px ne donne qu'un fil de grains ; plein, le corps est dense et ses bords s'effritent.
 */
const HEXAGON = 'M24 3 42 13.5v21L24 45 6 34.5v-21Z';
const LETTER = 'M15 33 24 13l9 20M19 26h10';
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="768" height="768"><defs><mask id="m"><rect width="48" height="48" fill="#fff"/><path d="${LETTER}" fill="none" stroke="#000" stroke-width="3.8"/></mask></defs><path d="${HEXAGON}" fill="#fff" mask="url(#m)"/></svg>`;

// Un serveur qui ne sert que les modules du dossier js/fx/ du dépôt, le temps de l'échantillonnage
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replaceAll('\\', '/');
  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>bake</title>'); return; }
  if (!/^\/js\/fx\/[a-z0-9-]+\.js$/.test(path)) { res.writeHead(404).end(); return; }
  try {
    res.writeHead(200, { 'content-type': 'text/javascript' }).end(await readFile(join(ROOT, path)));
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base);
  const grains = await page.evaluate(async ({ svg, count }) => {
    const { Shapes, sampleShape } = await import('/js/fx/particle-silhouette.js');
    const g = await sampleShape(Shapes.svg(svg, { label: 'logo' }), count);
    return { positions: Array.from(g.positions), edges: Array.from(g.edges), count: g.count, aspect: g.aspect, area: g.area };
  }, { svg: LOGO, count: EMBLEM_GRAINS.count });
  const bytes = encodeGrains(grains);
  const out = join(ROOT, EMBLEM_GRAINS.file);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(`✔ ${EMBLEM_GRAINS.file} : ${grains.count} grains, ${bytes.length} octets (rapport ${grains.aspect.toFixed(3)})`);
} finally {
  await browser.close();
  server.close();
}
