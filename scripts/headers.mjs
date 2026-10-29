/**
 * En-têtes HTTP du site (1.9.0), écrits par la génération dans dist/_headers, que Netlify applique.
 * Ils ne sont plus dans netlify.toml : la CSP porte l'empreinte de chaque script et style en ligne,
 * qui change dès qu'une page ou la feuille de style change. Une seule source, recalculée à chaque génération.
 *
 * Aucune règle ne répète un en-tête d'une autre règle qui viserait la même adresse : la sécurité
 * sur /*, le cache sur des dossiers distincts.
 */

/**
 * La politique de sécurité du contenu : rien d'un autre domaine, aucun code en ligne
 * sauf celui dont l'empreinte est listée, aucun `unsafe-inline` ni `unsafe-eval`.
 * @param {{ scripts: Iterable<string>, styles: Iterable<string> }} hashes empreintes 'sha256-…' des blocs en ligne
 */
export function contentSecurityPolicy({ scripts, styles }) {
  const quoted = (hashes) => [...hashes].sort().map((hash) => `'${hash}'`);
  return [
    "default-src 'none'",
    ["script-src 'self'", ...quoted(scripts)].join(' '),
    ["style-src 'self'", ...quoted(styles)].join(' '),
    "img-src 'self'",
    "font-src 'self'",
    "media-src 'self'",
    "manifest-src 'self'",
    // Le formulaire de contact (Netlify Forms) : envoi par Vue (fetch) ou par le navigateur.
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/**
 * Cache. Fichiers sans empreinte dans leur nom : le navigateur revérifie à chaque visite (réponse 304
 * quasi instantanée grâce à l'ETag), pour que les mises à jour soient vues tout de suite.
 * Polices et bibliothèques : la version est dans le nom, gardées un an.
 */
const CACHE = {
  '/assets/*': 'public, max-age=86400, must-revalidate',
  '/css/*': 'public, max-age=0, must-revalidate',
  '/js/*': 'public, max-age=0, must-revalidate',
  '/fonts/*': 'public, max-age=31536000, immutable',
  '/vendor/*': 'public, max-age=31536000, immutable',
};

/** Le contenu de dist/_headers. */
export function headersFile(csp) {
  const rule = (path, headers) => [path, ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`)].join('\n');
  return [
    '# Généré par scripts/build.mjs (scripts/headers.mjs) : ne pas modifier.',
    rule('/*', { ...SECURITY, 'Content-Security-Policy': csp }),
    ...Object.entries(CACHE).map(([path, value]) => rule(path, { 'Cache-Control': value })),
  ].join('\n\n') + '\n';
}

/** Lit un fichier _headers : [{ path, headers }] (pour le serveur local et les tests). */
export function parseHeadersFile(text) {
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { rules.push({ path: line.trim(), headers: {} }); continue; }
    const colon = line.indexOf(':');
    rules.at(-1).headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return rules;
}
