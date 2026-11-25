/**
 * Précalcule les grains des formes en poussière d'or : le logo de la section « Bande-son » (1.21.0) et la
 * devise en tête des offres, une par langue (1.23.0). Un Chromium sans écran échantillonne chaque forme avec
 * le module du site (js/fx/particle-silhouette.js), puis le fichier est écrit dans assets/grains/. Le
 * navigateur du visiteur n'échantillonne rien : cela coûtait de 150 à 590 ms au ralenti 4 ×.
 *
 * À relancer seulement quand une forme change : npm run bake:grains [emblem | taglines] (les fichiers sont
 * versionnés, la génération du site ne les refait pas, Netlify n'ayant pas de navigateur). Le fichier du logo
 * reste celui de 1.21.0 tant qu'on ne demande pas « emblem » : ses éclats (emblem-shards.bin) suivent ses
 * grains un par un.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { encodeGrains } from '../js/fx/grain-file.js';
import { EMBLEM_GRAINS } from '../js/fx/soundtrack-grains.js';
import { TAGLINE_GRAINS, taglineFile } from '../js/fx/clients-dust.js';
import { TAGLINES } from './taglines.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WANTED = new Set(process.argv.slice(2));
const wants = (name) => (WANTED.size === 0 ? name === 'taglines' : WANTED.has(name));

/**
 * Le logo du site (l'hexagone et son A, comme dans l'en-tête), plein : l'hexagone dense, le A évidé. Un contour
 * de 2 px ne donne qu'un fil de grains ; plein, le corps est dense et ses bords s'effritent.
 */
const HEXAGON = 'M24 3 42 13.5v21L24 45 6 34.5v-21Z';
const LETTER = 'M15 33 24 13l9 20M19 26h10';
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="768" height="768"><defs><mask id="m"><rect width="48" height="48" fill="#fff"/><path d="${LETTER}" fill="none" stroke="#000" stroke-width="3.8"/></mask></defs><path d="${HEXAGON}" fill="#fff" mask="url(#m)"/></svg>`;

// Un serveur qui ne sert, le temps de l'échantillonnage, que les modules de js/fx/ et les deux fichiers de
// Clivage du dépôt (la police ne quitte pas la machine : seul le navigateur de génération la lit)
const FONTS = new Set(['/fonts/clivage-v2-latin.woff2', '/fonts/clivage-v2-cyrillic.woff2']);
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replaceAll('\\', '/');
  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>bake</title>'); return; }
  const font = FONTS.has(path);
  if (!font && !/^\/js\/fx\/[a-z0-9-]+\.js$/.test(path)) { res.writeHead(404).end(); return; }
  try {
    res.writeHead(200, { 'content-type': font ? 'font/woff2' : 'text/javascript' }).end(await readFile(join(ROOT, path)));
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const write = async (file, grains) => {
  const bytes = encodeGrains(grains);
  const out = join(ROOT, file);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(`✔ ${file} : ${grains.count} grains, ${bytes.length} octets (rapport ${grains.aspect.toFixed(3)})`);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base);

  if (wants('emblem')) {
    await write(EMBLEM_GRAINS.file, await page.evaluate(async ({ svg, count }) => {
      const { Shapes, sampleShape } = await import('/js/fx/particle-silhouette.js');
      const g = await sampleShape(Shapes.svg(svg, { label: 'logo' }), count);
      return { positions: Array.from(g.positions), edges: Array.from(g.edges), count: g.count, aspect: g.aspect, area: g.area };
    }, { svg: LOGO, count: EMBLEM_GRAINS.count }));
  }

  if (wants('taglines')) {
    // Clivage 700, latin et cyrillique sous un même nom, comme sur le site (css/fonts.css)
    await page.evaluate(async () => {
      const faces = [
        new FontFace('Clivage', 'url(/fonts/clivage-v2-latin.woff2)', { weight: '100 900' }),
        new FontFace('Clivage', 'url(/fonts/clivage-v2-cyrillic.woff2)', { weight: '100 900', unicodeRange: 'U+0306, U+0400-045F' }),
      ];
      for (const face of faces) document.fonts.add(await face.load());
    });
    for (const [lang, text] of Object.entries(TAGLINES)) {
      await write(taglineFile(lang), await page.evaluate(async ({ text, count }) => {
        const { sampleShape } = await import('/js/fx/particle-silhouette.js');
        const lines = text.split('\n');
        const LINE_HEIGHT = 0.92, SIZE = 100;
        // Le texte tracé sur une toile, chaque ligne centrée ; l'échantillonnage recadre sur l'encre
        const shape = {
          label: text.replace('\n', ' '),
          async rasterize(maxPx) {
            const probe = document.createElement('canvas').getContext('2d');
            probe.font = `700 ${SIZE}px Clivage`;
            const boxW = Math.max(...lines.map((l) => probe.measureText(l).width)) + SIZE * 0.4;
            const boxH = SIZE * (LINE_HEIGHT * (lines.length - 1) + 1.35);
            const k = maxPx / Math.max(boxW, boxH);
            const w = Math.ceil(boxW * k), h = Math.ceil(boxH * k);
            const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.font = `700 ${SIZE * k}px Clivage`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            lines.forEach((l, i) => ctx.fillText(l, w / 2, (SIZE * 0.98 + i * SIZE * LINE_HEIGHT) * k));
            const rgba = ctx.getImageData(0, 0, w, h).data;
            const alpha = new Uint8ClampedArray(w * h);
            for (let i = 0, j = 3; i < alpha.length; i++, j += 4) alpha[i] = rgba[j];
            return { alpha, w, h };
          },
        };
        if (!document.fonts.check('700 1em Clivage', text)) throw new Error(`Clivage ne couvre pas « ${text} »`);
        const g = await sampleShape(shape, count);
        return { positions: Array.from(g.positions), edges: Array.from(g.edges), count: g.count, aspect: g.aspect, area: g.area };
      }, { text, count: TAGLINE_GRAINS.count }));
    }
  }
} finally {
  await browser.close();
  server.close();
}
