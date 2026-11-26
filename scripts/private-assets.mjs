/**
 * Nos propres composants (1.23.1) : Clivage, la silhouette de grains, ses fichiers de grains et Sfumato ne
 * sont pas dans ce dépôt public (règle « nos composants restent à nous » du 26 novembre 2026). Leurs fichiers
 * compilés sont dans le dépôt privé adamrodwebdev/adamrodwebdev-portfolio-assets ; cette étape les copie à
 * leur place (mêmes chemins qu'avant : CSS, imports et CSP ne changent pas), avant la génération.
 *
 *   npm run assets         copie les fichiers de private-assets.lock.json (première étape de build et de test)
 *   npm run assets:lock    épingle le commit actuel du dépôt privé (copie locale) et l'empreinte de chaque fichier
 *
 * Le verrou (public) donne le commit du dépôt privé et, pour chaque fichier, sa taille et son SHA-256. Un
 * fichier déjà en place et intact n'est pas relu. Sinon, dans l'ordre :
 *  1. une copie locale du dépôt privé : PORTFOLIO_ASSETS_DIR, ou le dossier voisin du dépôt
 *     (…/claude/adamrodwebdev-portfolio-assets), lu au commit épinglé (git show), quel que soit son état ;
 *  2. l'API de GitHub au commit épinglé, avec un jeton en lecture seule limité au dépôt privé :
 *     PORTFOLIO_ASSETS_TOKEN (variable d'environnement de Netlify), ou hors de Netlify `gh auth token`.
 * Un fichier manquant, une taille ou une empreinte fausse, ni copie ni jeton : la génération s'arrête et
 * nomme chaque problème. Le jeton n'est jamais écrit dans un journal.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const LOCK_FILE = 'private-assets.lock.json';
export const REPOSITORY = 'adamrodwebdev/adamrodwebdev-portfolio-assets';
const LIMITS = Object.freeze({ lockBytes: 16 * 1024, fileBytes: 2 * 1024 * 1024, files: 64, pathChars: 1024 });
/** Les seuls chemins qu'un fichier privé peut prendre : une liste fermée de dossiers et d'extensions. */
export const PRIVATE_PATH = /^(fonts|js\/fx|js\/audio|assets\/grains|scripts)\/[a-z0-9-]+\.(woff2|js|bin|json)$/;
const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const TOKEN = /^[A-Za-z0-9_]{20,255}$/;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Le verrou, vérifié champ par champ : tout ce qui ne va pas est refusé. */
export function parseLock(text) {
  if (typeof text !== 'string' || text.length > LIMITS.lockBytes) throw new RangeError(`${LOCK_FILE} : plus de ${LIMITS.lockBytes} octets`);
  const lock = JSON.parse(text);
  if (!isPlainObject(lock)) throw new TypeError(`${LOCK_FILE} : un objet est attendu`);
  if (lock.repository !== REPOSITORY) throw new TypeError(`${LOCK_FILE} : dépôt inattendu`);
  if (typeof lock.commit !== 'string' || !COMMIT.test(lock.commit)) throw new TypeError(`${LOCK_FILE} : commit invalide`);
  if (!Array.isArray(lock.files) || lock.files.length === 0 || lock.files.length > LIMITS.files) {
    throw new RangeError(`${LOCK_FILE} : de 1 à ${LIMITS.files} fichiers`);
  }
  const seen = new Set();
  const files = lock.files.map((file, i) => {
    const where = `${LOCK_FILE}, fichier ${i + 1}`;
    if (!isPlainObject(file)) throw new TypeError(`${where} : un objet est attendu`);
    const { path, size, sha256: hash } = file;
    if (typeof path !== 'string' || !PRIVATE_PATH.test(path) || seen.has(path)) throw new TypeError(`${where} : chemin refusé`);
    if (!Number.isSafeInteger(size) || size < 1 || size > LIMITS.fileBytes) throw new RangeError(`${where} : taille hors limites`);
    if (typeof hash !== 'string' || !SHA256.test(hash)) throw new TypeError(`${where} : empreinte invalide`);
    seen.add(path);
    return Object.freeze({ path, size, sha256: hash });
  });
  return Object.freeze({ repository: lock.repository, commit: lock.commit, files: Object.freeze(files) });
}

/** Un chemin venu de l'environnement : un vrai texte, sans caractère de contrôle, de longueur bornée. */
function envPath(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  // eslint-disable-next-line no-control-regex
  if (value.length > LIMITS.pathChars || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError('PORTFOLIO_ASSETS_DIR refusé');
  return resolve(value);
}

const git = (dir, args, encoding = 'utf8') =>
  execFileSync('git', ['-C', dir, ...args], { encoding, maxBuffer: LIMITS.fileBytes + 1, stdio: ['ignore', 'pipe', 'ignore'] });

/** La copie locale du dépôt privé, s'il y en a une : la variable, sinon le dossier voisin du dépôt principal. */
export function localCheckout(root, env) {
  const asked = envPath(env.PORTFOLIO_ASSETS_DIR);
  if (asked) return asked;
  try {
    // Le dépôt principal, même depuis un arbre de travail de .claude/worktrees/ : son dossier .git commun
    const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
    const sibling = join(dirname(dirname(common)), 'adamrodwebdev-portfolio-assets');
    return existsSync(join(sibling, '.git')) ? sibling : null;
  } catch {
    return null;
  }
}

/** Le jeton : la variable d'environnement, sinon (hors de Netlify) celui de la commande gh, s'il y en a un. */
function token(env) {
  const raw = typeof env.PORTFOLIO_ASSETS_TOKEN === 'string' ? env.PORTFOLIO_ASSETS_TOKEN.trim() : '';
  if (raw) {
    if (!TOKEN.test(raw)) throw new TypeError('PORTFOLIO_ASSETS_TOKEN n’a pas la forme d’un jeton GitHub');
    return raw;
  }
  if (env.NETLIFY === 'true') return null;
  try {
    const fromGh = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 }).trim();
    return TOKEN.test(fromGh) ? fromGh : null;
  } catch {
    return null;
  }
}

/** Lit un fichier au commit épinglé dans la copie locale. */
function fromCheckout(dir, commit) {
  try {
    git(dir, ['cat-file', '-e', `${commit}^{commit}`]);
  } catch {
    throw new Error(`la copie locale ${dir} n'a pas le commit ${commit.slice(0, 12)} : git -C "${dir}" fetch`);
  }
  return async ({ path }) => git(dir, ['show', `${commit}:${path}`], 'buffer');
}

/** Lit un fichier au commit épinglé par l'API de GitHub (contenu brut), taille bornée avant lecture. */
function fromGitHub(secret, commit) {
  return async ({ path, size }) => {
    const url = `https://api.github.com/repos/${REPOSITORY}/contents/${path}?ref=${commit}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: 'application/vnd.github.raw+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'adamrodwebdev-portfolio-build',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      throw new Error(`GitHub répond ${response.status} : le jeton doit lire ${REPOSITORY} (Contents : lecture seule)`);
    }
    const declared = response.headers.get('content-length');
    if (declared !== null && (!/^\d{1,10}$/.test(declared) || Number(declared) !== size)) {
      await response.body?.cancel();
      throw new Error(`${declared} octets annoncés, ${size} attendus`);
    }
    return readAtMost(response.body, size);
  };
}

/** Le corps d'une réponse, refusé dès qu'il dépasse `size` octets. */
async function readAtMost(body, size) {
  if (!body) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.length;
    if (total > size) throw new RangeError(`plus de ${size} octets reçus`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

/** Copie chaque fichier du verrou à sa place. Renvoie la liste des problèmes (vide si tout est en place). */
export async function fetchPrivateAssets(root, { env = process.env, log = console.log } = {}) {
  const lock = parseLock(await readFile(join(root, LOCK_FILE), 'utf8'));
  const missing = [];
  for (const file of lock.files) {
    const current = await readFile(join(root, file.path)).catch(() => null);
    if (!current || current.length !== file.size || sha256(current) !== file.sha256) missing.push(file);
  }
  if (missing.length === 0) {
    log(`✔ composants privés : ${lock.files.length} fichiers en place (${lock.commit.slice(0, 12)})`);
    return [];
  }

  const checkout = localCheckout(root, env);
  let read;
  let source;
  try {
    if (checkout) {
      read = fromCheckout(checkout, lock.commit);
      source = `copie locale ${checkout}`;
    } else {
      const secret = token(env);
      if (secret) {
        read = fromGitHub(secret, lock.commit);
        source = `GitHub (${REPOSITORY})`;
      }
    }
  } catch (error) {
    return [error.message];
  }
  if (!read) {
    return [
      `${missing.length} fichier(s) privé(s) manquant(s), et ni copie locale ni jeton pour les lire :`,
      ...missing.map((file) => `  ${file.path}`),
      `Sur Netlify : la variable PORTFOLIO_ASSETS_TOKEN (jeton en lecture seule de ${REPOSITORY}).`,
      'En local : cloner le dépôt privé à côté de celui-ci, ou PORTFOLIO_ASSETS_DIR, ou gh auth login.',
    ];
  }

  const results = await Promise.all(missing.map(async (file) => {
    try {
      const bytes = await read(file);
      if (bytes.length !== file.size) return `${file.path} : ${bytes.length} octets, ${file.size} attendus`;
      if (sha256(bytes) !== file.sha256) return `${file.path} : empreinte différente de celle du verrou`;
      await mkdir(dirname(join(root, file.path)), { recursive: true });
      await writeFile(join(root, file.path), bytes);
      return null;
    } catch (error) {
      return `${file.path} : ${error.message}`;
    }
  }));
  const problems = results.filter(Boolean);
  if (problems.length === 0) log(`✔ composants privés : ${missing.length} fichier(s) copié(s) depuis ${source} (${lock.commit.slice(0, 12)})`);
  return problems;
}

/** Épingle le commit actuel de la copie locale : chaque fichier sous les dossiers permis, taille et empreinte. */
export async function writeLock(root, { env = process.env, log = console.log } = {}) {
  const dir = localCheckout(root, env);
  if (!dir) throw new Error('aucune copie locale du dépôt privé (dossier voisin ou PORTFOLIO_ASSETS_DIR)');
  const commit = git(dir, ['rev-parse', 'HEAD']).trim();
  if (!git(dir, ['branch', '-r', '--contains', commit]).trim()) {
    throw new Error(`le commit ${commit.slice(0, 12)} n'est pas poussé : Netlify le lit sur GitHub (git -C "${dir}" push)`);
  }
  const paths = git(dir, ['ls-tree', '-r', '--name-only', commit]).split('\n').filter((p) => PRIVATE_PATH.test(p)).sort();
  const files = paths.map((path) => {
    const bytes = git(dir, ['show', `${commit}:${path}`], 'buffer');
    return { path, size: bytes.length, sha256: sha256(bytes) };
  });
  const text = `${JSON.stringify({ repository: REPOSITORY, commit, files }, null, 2)}\n`;
  parseLock(text);
  await writeFile(join(root, LOCK_FILE), text);
  log(`✔ ${LOCK_FILE} : ${files.length} fichiers au commit ${commit.slice(0, 12)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    if (process.argv.includes('--lock')) {
      await writeLock(root);
    } else {
      const problems = await fetchPrivateAssets(root);
      if (problems.length) {
        console.error(`✘ composants privés :\n  ${problems.join('\n  ')}`);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`✘ composants privés : ${error.message}`);
    process.exit(1);
  }
}
