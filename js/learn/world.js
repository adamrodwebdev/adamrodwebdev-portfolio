/**
 * Le monde de l'épisode 1 (1.19.0), en unités du monde : un plan de métro entre « ton téléphone » et
 * « un serveur ». Plan entier en 9:16 ; le plan large garde tout entre 25 % et 78 % de la hauteur
 * (sous la bande des sous-titres, au-dessus de la légende et des boutons des applis).
 *
 * Aucune phrase n'y est écrite : une seule image sert toutes les langues. Seuls des noms qui se lisent
 * pareil partout (index.html, style.css, script.js, <h1>, ♥) et des icônes.
 */
export const WORLD = Object.freeze({ width: 900, height: 1600 });

/**
 * Les jetons du site, sur son fond noir (le film garde ce noir dans les deux thèmes) : l'or en trois tons,
 * la crème, le gris chaud, les plaques sombres. Aucune autre couleur : ni rouge, ni bleu, ni jaune.
 */
export const INK = Object.freeze({
  ground: '#000000',
  plate: '#0e0c08',
  plateHi: '#17140d',
  gold: '#e0b04a',
  goldHi: '#f5cf6e',
  goldDeep: '#9a7420',
  cream: '#f6f4ef',
  muted: '#a8a193',
  faint: '#57514a',
});

/**
 * Les trois formes qui distinguent les fichiers, à la place des couleurs : l'hexagone (HTML), le losange
 * (CSS), l'éclat (JavaScript). Sommets sur un rayon de 1, centrés sur 0 ; celles du logo et du site.
 */
export const SHAPES = Object.freeze({
  hex: Object.freeze([[0, -1], [0.866, -0.5], [0.866, 0.5], [0, 1], [-0.866, 0.5], [-0.866, -0.5]]),
  diamond: Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]),
  shard: Object.freeze([[0, -1], [1, 0.76], [-1, 0.28]]),
});

/**
 * Les trois fichiers d'une page : leur forme, son remplissage (plein ou contour), et des noms qui se lisent
 * pareil dans toutes les langues.
 */
export const FILES = Object.freeze({
  html: Object.freeze({ shape: 'hex', fill: INK.goldHi, outline: false, label: 'HTML', name: 'index.html' }),
  css: Object.freeze({ shape: 'diamond', fill: INK.cream, outline: true, label: 'CSS', name: 'style.css' }),
  js: Object.freeze({ shape: 'shard', fill: INK.gold, outline: false, label: 'JS', name: 'script.js' }),
});

/**
 * Les quatre lignes, côte à côte de gauche à droite vues du téléphone : la demande (l'or clair), puis ce
 * qui revient, HTML (or), CSS (crème), JavaScript (or en tirets). `offset` : écart au tracé central ;
 * `dash` : le motif d'une ligne en tirets ; `file` : le fichier qu'elle rapporte.
 */
export const LINES = Object.freeze([
  Object.freeze({ key: 'request', ink: INK.goldHi, dash: null, offset: -24, from: 'phone' }),
  Object.freeze({ key: 'html', ink: INK.gold, dash: null, offset: -8, from: 'server', file: 'html' }),
  Object.freeze({ key: 'css', ink: INK.cream, dash: null, offset: 8, from: 'server', file: 'css' }),
  Object.freeze({ key: 'js', ink: INK.gold, dash: '16 12', offset: 24, from: 'server', file: 'js' }),
]);

/**
 * Le tracé central, du port du téléphone à celui du serveur : un long trait vertical, une diagonale à
 * 45°, un palier. Le trait vertical éloigne le reste du plan de l'écran : dans les plans serrés sur le
 * téléphone, la bande des sous-titres ne montre que le haut de ce trait, sous son dégradé sombre.
 */
export const ROUTE = Object.freeze([
  [330, 740],
  [330, 580],
  [490, 420],
  [600, 420],
]);

/** Les stations : les deux terminus et la correspondance d'Internet, au milieu de la diagonale. */
export const STATIONS = Object.freeze({
  phone: Object.freeze({ x: 330, y: 740 }),
  internet: Object.freeze({ x: 410, y: 500 }),
  server: Object.freeze({ x: 600, y: 420 }),
});

/**
 * Internet, à côté de sa correspondance, du côté vide du plan (à gauche de la diagonale) : un hexagone
 * (la station du réseau). Quand il s'ouvre sur le réseau, le plan d'Internet n'a pas le serveur dans son cadre.
 */
export const GLOBE = Object.freeze({ x: 300, y: 470, r: 30 });

/** Le serveur : une baie de trois plaques chanfreinées, son port sur le flanc gauche. */
export const SERVER = Object.freeze({ x: 600, y: 320, width: 160, height: 200, units: 3 });

/** Le fond déborde largement du monde : la caméra peut reculer au-delà pour le plan large. */
export const GROUND = Object.freeze({ x: -600, y: -600, width: 2100, height: 2800 });

/**
 * Internet quand le globe s'ouvre (épisode 1) : des téléphones, des ordinateurs portables et des
 * serveurs, reliés par des câbles (des traits) ; les téléphones parlent aussi par ondes radio (des arcs).
 * Dans le coin sombre à gauche de la diagonale, au-dessus du téléphone : loin du serveur, qui reste
 * hors du cadre et hors de la bande des sous-titres.
 */
export const NETWORK = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({ id: 'a', kind: 'phone', x: 196, y: 372 }),
    Object.freeze({ id: 'b', kind: 'laptop', x: 96, y: 430 }),
    Object.freeze({ id: 'c', kind: 'rack', x: 70, y: 566 }),
    Object.freeze({ id: 'd', kind: 'phone', x: 188, y: 528 }),
    Object.freeze({ id: 'e', kind: 'laptop', x: 104, y: 690 }),
    Object.freeze({ id: 'f', kind: 'phone', x: 248, y: 640 }),
  ]),
  /** Les câbles, de nœud à nœud ; « globe » est le globe d'Internet. */
  links: Object.freeze([
    ['globe', 'a'], ['a', 'b'], ['b', 'c'], ['a', 'd'], ['d', 'c'], ['d', 'f'], ['f', 'e'], ['e', 'c'], ['globe', 'd'],
  ]),
  /** Les appareils qui parlent par ondes radio (Wi-Fi, 4G). */
  waves: Object.freeze(['a', 'd', 'f']),
});

/** Le jour et la nuit au-dessus du serveur : il reste allumé. */
export const DAY_NIGHT = Object.freeze({ x: 680, y: 284, r: 17 });

/** Le plateau du serveur, sous la baie : il y pose les trois documents, comme un serveur au restaurant. */
export const TRAY = Object.freeze({ x: 610, y: 566, width: 140 });

/**
 * Le paquet de données du binaire : « PAGE ? » sur sa plaque, relié à la tête de la ligne par un filet d'or.
 * Il voyage sous la tête (`drop`) et glisse vers la gauche (`shift`) à l'approche du serveur : sa plaque
 * (352 × 104 à l'échelle 1) s'arrête à 40 unités au moins de la baie, et ses octets restent dans l'image.
 */
export const PACKET = Object.freeze({ scale: 0.75, drop: 120, shift: 190, plate: Object.freeze({ width: 352, height: 104 }) });

/** Un document : sa largeur et sa hauteur, le coin plié. */
export const DOC = Object.freeze({ width: 30, height: 40, fold: 9 });

/** Le téléphone, son écran, la barre du navigateur et la zone de la page. */
export const PHONE = Object.freeze({ x: 180, y: 740, width: 300, height: 500, radius: 40 });
export const SCREEN = Object.freeze({ x: 192, y: 752, width: 276, height: 476, radius: 30 });
export const BAR = Object.freeze({ x: 192, y: 752, width: 276, height: 48 });
export const PAGE = Object.freeze({ x: 192, y: 800, width: 276, height: 428 });

/**
 * Un tracé décalé de `d` unités sur sa gauche (dans le sens du tracé), angles compris : chaque coin
 * se décale le long de la bissectrice, pour que les lignes restent parallèles.
 */
export function offsetPath(points, d) {
  const normal = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    return [-dy / length, dx / length];
  };
  return points.map((point, k) => {
    const before = k > 0 ? normal(points[k - 1], point) : normal(point, points[k + 1]);
    const after = k < points.length - 1 ? normal(point, points[k + 1]) : before;
    let nx = before[0] + after[0];
    let ny = before[1] + after[1];
    const length = Math.hypot(nx, ny) || 1;
    nx /= length;
    ny /= length;
    const cos = nx * before[0] + ny * before[1] || 1;
    return [point[0] + (nx * d) / cos, point[1] + (ny * d) / cos];
  });
}

/** Le tracé d'une ligne dans son sens de parcours : du téléphone au serveur pour la demande, l'inverse sinon. */
export function linePoints(line) {
  const points = offsetPath(ROUTE, line.offset);
  return line.from === 'phone' ? points : [...points].reverse();
}

/** La longueur d'un tracé fait de segments droits. */
export function polylineLength(points) {
  let length = 0;
  for (let k = 1; k < points.length; k++) length += Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]);
  return length;
}

/** Le point situé à la fraction `f` (0 à 1) de la longueur d'un tracé. */
export function pointAlong(points, f) {
  let left = Math.min(1, Math.max(0, f)) * polylineLength(points);
  for (let k = 1; k < points.length; k++) {
    const [ax, ay] = points[k - 1];
    const [bx, by] = points[k];
    const segment = Math.hypot(bx - ax, by - ay);
    if (left <= segment || k === points.length - 1) {
      const g = segment ? Math.min(1, left / segment) : 0;
      return [ax + (bx - ax) * g, ay + (by - ay) * g];
    }
    left -= segment;
  }
  return points[0];
}

/** La fraction d'un tracé où il passe au plus près de `point` (une station sur la ligne). */
export function fractionNear(points, point) {
  const total = polylineLength(points);
  let walked = 0;
  let best = { distance: Infinity, at: 0 };
  for (let k = 1; k < points.length; k++) {
    const [ax, ay] = points[k - 1];
    const [bx, by] = points[k];
    const segment = Math.hypot(bx - ax, by - ay);
    const g = segment ? Math.min(1, Math.max(0, ((point.x - ax) * (bx - ax) + (point.y - ay) * (by - ay)) / segment ** 2)) : 0;
    const distance = Math.hypot(ax + (bx - ax) * g - point.x, ay + (by - ay) * g - point.y);
    if (distance < best.distance) best = { distance, at: (walked + g * segment) / total };
    walked += segment;
  }
  return best.at;
}
