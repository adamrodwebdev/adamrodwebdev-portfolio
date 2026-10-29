/**
 * Serveur local de dist/ qui se comporte comme Netlify sur ce qui compte pour les essais (1.9.0) :
 * en-têtes de dist/_headers (CSP comprise), compression Brotli ou gzip, index des dossiers,
 * adresses sans .html, pages 404 (française et anglaise) et envoi du formulaire accepté.
 *
 *   npm run build && npm run serve        (http://localhost:8080, ou PORT=… npm run serve)
 *
 * Il sert aux tests Playwright, à Lighthouse et au panneau d'aperçu. Les redirections de netlify.toml
 * ne sont pas jouées.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { parseHeadersFile } from './headers.mjs';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.ico': 'image/x-icon',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.xml', '.txt', '.svg']);

/**
 * Les en-têtes des règles de dist/_headers qui visent `path` (« /dossier/* » vise tout ce qu'il contient).
 * Le fichier est relu à chaque requête : une nouvelle génération est prise en compte sans relancer le serveur.
 */
async function headersFor(path) {
  const rules = parseHeadersFile(await readFile(join(DIST, '_headers'), 'utf8'));
  return Object.assign({}, ...rules
    .filter((rule) => (rule.path.endsWith('*') ? path.startsWith(rule.path.slice(0, -1)) : path === rule.path))
    .map((rule) => rule.headers));
}

const isFile = async (file) => (await stat(file).catch(() => null))?.isFile() ?? false;

/** Le fichier de dist/ que sert une adresse ({ file, folder } : folder si c'est l'index d'un dossier), ou null. */
async function resolve(path) {
  const file = normalize(join(DIST, decodeURIComponent(path)));
  if (!file.startsWith(DIST) || /[\\/]_headers$/.test(file)) return null;
  if (await isFile(file)) return { file, folder: false };
  if (await isFile(join(file, 'index.html'))) return { file: join(file, 'index.html'), folder: true };
  if (await isFile(`${file}.html`)) return { file: `${file}.html`, folder: false };
  return null;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const found = await resolve(pathname);
  // Un dossier sans barre finale : redirigé, comme le fait Netlify (/lumirift → /lumirift/).
  if (found?.folder && !pathname.endsWith('/')) {
    response.writeHead(301, { Location: `${pathname}/` }).end();
    return;
  }
  let file = found?.file;
  let status = 200;
  if (!file) {
    status = 404;
    file = join(DIST, pathname.startsWith('/en/') ? 'en/404.html' : '404.html');
  }
  // Netlify Forms : l'envoi est accepté, puis la page d'action est servie.
  if (request.method === 'POST') request.resume();

  const type = extname(file);
  let body = await readFile(file);
  const headers = { 'Content-Type': TYPES[type] ?? 'application/octet-stream', ...(await headersFor(pathname)), Vary: 'Accept-Encoding' };
  const accepted = request.headers['accept-encoding'] ?? '';
  if (COMPRESSIBLE.has(type) && /\bbr\b/.test(accepted)) { body = brotliCompressSync(body); headers['Content-Encoding'] = 'br'; }
  else if (COMPRESSIBLE.has(type) && /\bgzip\b/.test(accepted)) { body = gzipSync(body); headers['Content-Encoding'] = 'gzip'; }
  headers['Content-Length'] = body.length;
  response.writeHead(status, headers).end(request.method === 'HEAD' ? undefined : body);
}).listen(PORT, () => console.log(`dist/ servi sur http://localhost:${PORT}`));
