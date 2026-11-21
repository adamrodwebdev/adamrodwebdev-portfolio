/**
 * La scène des épisodes (1.19.0) : le monde dessiné une fois en SVG, aux couleurs du site (noir, or,
 * crème ; plaques chanfreinées, hexagones, grille de 64 qui s'efface vers le bas), puis un état appliqué
 * à chaque image. Elle ne décide rien : la mise en scène (episode01.js) calcule l'état à partir du temps,
 * la scène le peint. Les fichiers se distinguent par leur forme (hexagone, losange, éclat), jamais par
 * une couleur. Aucune phrase dans l'image : une seule image sert toutes les langues.
 */
import { BAR, DAY_NIGHT, DOC, FILES, GLOBE, GROUND, INK, LINES, NETWORK, PACKET, PAGE, PHONE, SCREEN, SERVER, SHAPES, STATIONS, TRAY, WORLD, linePoints, pointAlong, polylineLength } from './world.js';
import { chamfer, fixed, shapePoints, svg, svgText } from './svg.js';
import { fracClass } from './frac.js';
import { lerp } from './ease.js';

/**
 * L'écran du téléphone quand une mise en scène n'en dit rien : tout caché. Chaque épisode ne donne que
 * ce qu'il montre (`{ ...SCREEN_DEFAULTS, links: 1 }`).
 */
export const SCREEN_DEFAULTS = Object.freeze({
  links: 0,
  ripple: Object.freeze({ r: 0, opacity: 0 }),
  loading: 0,
  wait: 0,
  spin: 0,
  received: Object.freeze([0, 0, 0]),
  file: 0,
  code: Object.freeze([0, 0, 0, 0]),
  page: 0,
  boxes: Object.freeze([{ shown: 0 }, { shown: 0 }, { shown: 0 }, { shown: 0 }]),
  dress: 0,
  badges: 0,
  badge: 'html',
  pop: 0,
  likes: 0,
});

/** La grille du fond, en unités du monde : 64 px dans un cadre de 900, au zoom des plans serrés. */
const GRID = 36;

/** Les boîtes de la page qui se construit (épisode 2), dans la zone de la page. */
const BOXES = Object.freeze([
  Object.freeze({ tag: 'h1', x: 212, y: 828, width: 236, height: 52 }),
  Object.freeze({ tag: 'p', x: 212, y: 902, width: 236, height: 70 }),
  Object.freeze({ tag: 'img', x: 212, y: 994, width: 236, height: 116 }),
  Object.freeze({ tag: 'button', x: 212, y: 1134, width: 112, height: 50 }),
]);

/** Le code du fichier index.html (épisode 2), ligne à ligne : [balise ouvrante, contenu, balise fermante]. */
const CODE = Object.freeze([
  ['<h1>', '…', '</h1>'],
  ['<p>', '…', '</p>'],
  ['<img>', '', ''],
  ['<button>', '♥', '</button>'],
]);

/** Les octets qui flottent autour du mot brisé, à leur place autour de lui (unités du jeton). */
const BIT_PLACES = Object.freeze([[-196, -96], [84, -118], [-170, 116], [120, 102], [-24, 158]]);
/** La plaque du mot en route, un paquet de données : assez large pour « PAGE ? » en Clivage à 80. */
const WORD_PLATE = Object.freeze({ x: -PACKET.plate.width / 2, y: -58, width: PACKET.plate.width, height: PACKET.plate.height });

const toRgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
/** Une couleur entre `a` et `b` (#rrggbb), pour `f` entre 0 et 1. */
const mix = (a, b, f) => `rgb(${toRgb(a).map((v, i) => Math.round(lerp(v, toRgb(b)[i], f))).join(' ')})`;

/** Pose une classe seulement si elle change : une valeur FRAC qui ne bouge pas ne coûte rien. */
function setClass(element, value) {
  if (element.getAttribute('class') !== value) element.setAttribute('class', value);
}

export class Scene {
  /** @param {SVGSVGElement} root l'élément <svg> de la scène, vide */
  constructor(root) {
    this.root = root;
    root.setAttribute('viewBox', `0 0 ${WORLD.width} ${WORLD.height}`);
    root.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    this.#defs();
    this.gridMask = this.#ground();
    this.lines = Object.fromEntries(LINES.map((line) => [line.key, this.#line(line)]));
    this.stations = this.#stations();
    this.#internet();
    this.network = this.#network();
    this.server = this.#server();
    this.dayNight = this.#dayNight();
    this.tray = this.#tray();
    this.phone = this.#phone();
    this.docs = this.#docs();
    this.token = this.#token();
  }

  /** Une forme de fichier (hexagone, losange, éclat) de rayon `r`, en (`x`, `y`). */
  #shape(parent, key, x, y, r) {
    const file = FILES[key];
    const fill = file.outline ? { fill: 'none', stroke: file.fill, 'stroke-width': Math.max(2, r * 0.22), 'stroke-linejoin': 'round' } : { fill: file.fill };
    return svg('polygon', { points: shapePoints(SHAPES[file.shape], x, y, r), ...fill }, parent);
  }

  /** Un fichier en route : une petite plaque chanfreinée et sa forme. Centré sur 0. */
  #document(parent, key) {
    const { width: w, height: h } = DOC;
    const group = svg('g', {}, parent);
    svg('path', { d: chamfer({ x: -w / 2 - 4, y: -h / 2, width: w + 8, height: h }, 9), fill: INK.ground, stroke: INK.gold, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, group);
    this.#shape(group, key, 0, 0, 11);
    return group;
  }

  /**
   * Internet, ouvert : des appareils (téléphones, portables, serveurs) en plaques chanfreinées, reliés par
   * des câbles que la plume trace, des ondes radio autour des téléphones, et des messages (de petits
   * hexagones d'or) qui filent sur les câbles.
   */
  #network() {
    const group = svg('g', { opacity: 0 }, this.root);
    const at = (id) => (id === 'globe' ? { x: GLOBE.x, y: GLOBE.y } : NETWORK.nodes.find((node) => node.id === id));
    const links = NETWORK.links.map(([from, to]) => {
      const a = at(from);
      const b = at(to);
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const line = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: INK.cream, 'stroke-width': 2.5, 'stroke-opacity': 0.5, 'stroke-dasharray': `${fixed(length)} ${fixed(length)}`, 'stroke-dashoffset': fixed(length) }, group);
      const pulse = svg('polygon', { points: shapePoints(SHAPES.hex, 0, 0, 6), fill: INK.goldHi, opacity: 0 }, group);
      return { a, b, length, line, pulse };
    });
    const waves = NETWORK.waves.map((id) => {
      const node = at(id);
      const arcs = svg('g', { fill: 'none', stroke: INK.cream, 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: 0 }, group);
      for (const r of [16, 26]) svg('path', { d: `M${node.x + r * 0.7} ${node.y - 22 - r * 0.7}a${r} ${r} 0 0 1 0 ${fixed(r * 1.4)}`, transform: `rotate(-45 ${node.x} ${node.y - 22})` }, arcs);
      return arcs;
    });
    const nodes = NETWORK.nodes.map((node) => {
      const item = svg('g', { transform: `translate(${node.x} ${node.y})` }, group);
      const draw = { fill: INK.plateHi, stroke: INK.cream, 'stroke-width': 2.5, 'stroke-linejoin': 'round' };
      if (node.kind === 'phone') {
        svg('path', { d: chamfer({ x: -10, y: -17, width: 20, height: 34 }, 5), ...draw }, item);
      } else if (node.kind === 'laptop') {
        svg('path', { d: chamfer({ x: -17, y: -13, width: 34, height: 22 }, 5), ...draw }, item);
        svg('path', { d: 'M-23 12h46', stroke: INK.cream, 'stroke-width': 3.5 }, item);
      } else {
        svg('path', { d: chamfer({ x: -14, y: -19, width: 28, height: 38 }, 6), ...draw }, item);
        for (const y of [-9, 1, 11]) svg('line', { x1: -7, y1: y, x2: 7, y2: y, stroke: INK.gold, 'stroke-width': 2.5 }, item);
      }
      return item;
    });
    return { group, links, waves, nodes };
  }

  /** Le jour et la nuit au-dessus du serveur : un soleil d'or qui devient une lune crème, et revient. */
  #dayNight() {
    const { x, y, r } = DAY_NIGHT;
    const group = svg('g', { opacity: 0 }, this.root);
    const sun = svg('g', {}, group);
    svg('polygon', { points: shapePoints(SHAPES.hex, x, y, r * 0.66), fill: INK.gold }, sun);
    for (let k = 0; k < 6; k++) {
      const angle = (k * Math.PI) / 3 + Math.PI / 6;
      svg('line', { x1: fixed(x + Math.cos(angle) * r * 0.95), y1: fixed(y + Math.sin(angle) * r * 0.95), x2: fixed(x + Math.cos(angle) * r * 1.35), y2: fixed(y + Math.sin(angle) * r * 1.35), stroke: INK.gold, 'stroke-width': 3 }, sun);
    }
    // Un croissant : le demi-cercle de gauche, refermé par un arc plus plat ; il s'ouvre vers la droite.
    const flat = r * 1.35;
    const moon = svg('path', { d: `M${x} ${y - r}A${r} ${r} 0 0 0 ${x} ${y + r}A${fixed(flat)} ${fixed(flat)} 0 0 1 ${x} ${y - r}Z`, fill: INK.cream }, group);
    return { group, sun, moon };
  }

  /** Le plateau du serveur et ses trois fichiers, qui glissent hors de la baie. */
  #tray() {
    const group = svg('g', { opacity: 0 }, this.root);
    svg('path', { d: `M${TRAY.x} ${TRAY.y}h${TRAY.width}`, stroke: INK.gold, 'stroke-width': 5 }, group);
    svg('path', { d: `M${TRAY.x + 8} ${TRAY.y + 2}l10 10h${TRAY.width - 36}l10 -10`, fill: 'none', stroke: INK.gold, 'stroke-width': 3, 'stroke-linejoin': 'round' }, group);
    const docs = ['html', 'css', 'js'].map((key) => this.#document(group, key));
    return { group, docs };
  }

  /** Les trois fichiers qui reviennent au téléphone, chacun sur sa ligne, chacun avec sa forme. */
  #docs() {
    return Object.fromEntries(['html', 'css', 'js'].map((key) => {
      const group = svg('g', { opacity: 0 }, this.root);
      this.#document(group, key);
      return [key, group];
    }));
  }

  #defs() {
    const defs = svg('defs', {}, this.root);
    // La grille du site : un carré de 64 px en filets d'or, effacée vers le bas par un masque.
    const grid = svg('pattern', { id: 'learn-grid', width: GRID, height: GRID, patternUnits: 'userSpaceOnUse' }, defs);
    svg('path', { d: `M${GRID} 0H0V${GRID}`, fill: 'none', stroke: INK.gold, 'stroke-opacity': 0.14, 'stroke-width': 1.1 }, grid);
    const fade = svg('radialGradient', { id: 'learn-grid-fade', cx: 0.5, cy: 0.08, r: 0.8 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#fff' }, fade);
    svg('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, fade);
    const mask = svg('mask', { id: 'learn-grid-mask', maskUnits: 'userSpaceOnUse', x: GROUND.x, y: GROUND.y, width: GROUND.width, height: GROUND.height }, defs);
    this.gridMaskRect = svg('rect', { x: 0, y: 0, width: WORLD.width, height: WORLD.height, fill: 'url(#learn-grid-fade)' }, mask);
    // Une lueur d'or, à peine, au cœur du plan.
    const glow = svg('radialGradient', { id: 'learn-glow', cx: 0.5, cy: 0.42, r: 0.6 }, defs);
    svg('stop', { offset: 0, 'stop-color': INK.gold, 'stop-opacity': 0.12 }, glow);
    svg('stop', { offset: 1, 'stop-color': INK.gold, 'stop-opacity': 0 }, glow);
    // L'or du mot brisé, en biais : l'ombre, le reflet, l'or, l'ombre.
    const gold = svg('linearGradient', { id: 'learn-gold', x1: 0, y1: 0, x2: 1, y2: 0.3 }, defs);
    for (const [offset, colour] of [[0, INK.goldDeep], [0.4, INK.goldHi], [0.6, INK.gold], [1, INK.goldDeep]]) svg('stop', { offset, 'stop-color': colour }, gold);
    const dressed = svg('linearGradient', { id: 'learn-dressed', x1: 0, y1: 0, x2: 0.6, y2: 1 }, defs);
    svg('stop', { offset: '0%', 'stop-color': INK.plateHi }, dressed);
    svg('stop', { offset: '100%', 'stop-color': INK.goldDeep, 'stop-opacity': 0.35 }, dressed);
    const screenClip = svg('clipPath', { id: 'learn-screen' }, defs);
    svg('path', { d: chamfer(SCREEN, 26) }, screenClip);
    const picture = svg('clipPath', { id: 'learn-picture' }, defs);
    const img = BOXES[2];
    this.pictureClip = svg('rect', { x: img.x, y: img.y, width: img.width, height: img.height, rx: 0 }, picture);
    // Le dessin d'une ligne : un masque par ligne révèle le trait (plein ou en tirets) au fil de la plume.
    this.lineMasks = defs;
  }

  /** Le fond : noir, la lueur d'or, la grille masquée (le masque suit le cadre de la caméra). */
  #ground() {
    svg('rect', { ...GROUND, fill: INK.ground }, this.root);
    svg('rect', { width: WORLD.width, height: WORLD.height, fill: 'url(#learn-glow)' }, this.root);
    svg('rect', { ...GROUND, fill: 'url(#learn-grid)', mask: 'url(#learn-grid-mask)' }, this.root);
    return this.gridMaskRect;
  }

  /** Une ligne : son fantôme (le tracé à venir), le trait que la plume révèle, la plume (un hexagone). */
  #line(line) {
    const points = linePoints(line);
    const d = `M${points.map((p) => p.map(fixed).join(' ')).join(' L')}`;
    const group = svg('g', { class: `learn-line learn-line--${line.key}` }, this.root);
    svg('path', { d, fill: 'none', stroke: line.ink, 'stroke-width': 12, 'stroke-linejoin': 'round', 'stroke-opacity': 0.12 }, group);
    // Longueur calculée sur le tracé (segments droits), pas mesurée dans le DOM : la même dans le film et la page.
    const length = polylineLength(points);
    const mask = svg('mask', { id: `learn-draw-${line.key}`, maskUnits: 'userSpaceOnUse', x: GROUND.x, y: GROUND.y, width: GROUND.width, height: GROUND.height }, this.lineMasks);
    const reveal = svg('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 20, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': `${fixed(length)} ${fixed(length + 40)}`, 'stroke-dashoffset': fixed(length) }, mask);
    svg('path', { d, fill: 'none', stroke: line.ink, 'stroke-width': 8, 'stroke-linejoin': 'round', 'stroke-dasharray': line.dash, mask: `url(#learn-draw-${line.key})` }, group);
    const pen = svg('g', { opacity: 0 }, group);
    svg('polygon', { points: shapePoints(SHAPES.hex, 0, 0, 20), fill: line.ink, 'fill-opacity': 0.22 }, pen);
    svg('polygon', { points: shapePoints(SHAPES.hex, 0, 0, 10), fill: INK.ground, stroke: line.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }, pen);
    return { line, points, reveal, pen, length };
  }

  /** Les stations : une plaque chanfreinée en travers des quatre lignes, sombre puis d'or quand une ligne arrive. */
  #stations() {
    const plate = (x, y, angle) => {
      const group = svg('g', { transform: `rotate(${angle} ${x} ${y})` }, this.root);
      const halo = svg('path', { d: chamfer({ x: x - 56, y: y - 24, width: 112, height: 48 }, 14), fill: INK.goldHi, 'fill-opacity': 0 }, group);
      const body = svg('path', { d: chamfer({ x: x - 46, y: y - 14, width: 92, height: 28 }, 9), fill: INK.plate, stroke: INK.gold, 'stroke-width': 4, 'stroke-linejoin': 'round' }, group);
      return { halo, body };
    };
    return {
      phone: plate(STATIONS.phone.x, STATIONS.phone.y, 0),
      internet: plate(STATIONS.internet.x, STATIONS.internet.y, 45),
      server: plate(STATIONS.server.x, STATIONS.server.y, 90),
    };
  }

  /** Internet : la station du réseau, un hexagone dans un hexagone, un cœur d'or. */
  #internet() {
    const { x, y, r } = GLOBE;
    const group = svg('g', {}, this.root);
    svg('polygon', { points: shapePoints(SHAPES.hex, x, y, r), fill: INK.plateHi, stroke: INK.cream, 'stroke-width': 3, 'stroke-linejoin': 'round' }, group);
    svg('polygon', { points: shapePoints(SHAPES.hex, x, y, r * 0.55), fill: 'none', stroke: INK.gold, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, group);
    svg('polygon', { points: shapePoints(SHAPES.hex, x, y, r * 0.2), fill: INK.goldHi }, group);
  }

  /** La baie du serveur : trois plaques chanfreinées, chacune avec deux voyants qui clignotent quand il travaille. */
  #server() {
    const { x, y, width, height, units } = SERVER;
    const group = svg('g', {}, this.root);
    svg('path', { class: 'learn-server', d: chamfer({ x, y, width, height }, 18), fill: INK.plateHi, stroke: INK.gold, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, group);
    const leds = [];
    for (let k = 0; k < units; k++) {
      const top = y + 18 + k * 60;
      svg('path', { d: chamfer({ x: x + 16, y: top, width: width - 32, height: 46 }, 9), fill: INK.ground, stroke: INK.goldDeep, 'stroke-width': 2, 'stroke-linejoin': 'round' }, group);
      for (let s = 0; s < 3; s++) svg('line', { x1: x + 30 + s * 12, y1: top + 12, x2: x + 30 + s * 12, y2: top + 34, stroke: INK.muted, 'stroke-width': 3 }, group);
      leds.push(svg('polygon', { points: shapePoints(SHAPES.hex, x + width - 46, top + 23, 6.5), fill: INK.goldHi }, group));
      leds.push(svg('polygon', { points: shapePoints(SHAPES.hex, x + width - 28, top + 23, 6.5), fill: INK.cream }, group));
    }
    return { leds };
  }

  /** Le téléphone : son boîtier chanfreiné au liseré d'or, l'écran sombre, la barre du navigateur, les vues. */
  #phone() {
    svg('path', { d: chamfer(PHONE, 36), fill: INK.plate, stroke: INK.gold, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, this.root);
    const screen = svg('g', { 'clip-path': 'url(#learn-screen)' }, this.root);
    svg('rect', { x: SCREEN.x, y: SCREEN.y, width: SCREEN.width, height: SCREEN.height, fill: INK.plateHi }, screen);
    const dressedPage = svg('rect', { x: PAGE.x, y: PAGE.y, width: PAGE.width, height: PAGE.height, fill: 'url(#learn-dressed)', opacity: 0 }, screen);
    // La barre du navigateur : une plaque noire bordée d'or, un hexagone et l'adresse, un nom de domaine
    // qui se lit dans toutes les langues.
    svg('rect', { x: BAR.x, y: BAR.y, width: BAR.width, height: BAR.height, fill: INK.plate }, screen);
    svg('path', { d: chamfer({ x: BAR.x + 12, y: BAR.y + 9, width: BAR.width - 24, height: 30 }, 8), fill: INK.ground, stroke: INK.gold, 'stroke-opacity': 0.55, 'stroke-width': 1.5 }, screen);
    svg('polygon', { points: shapePoints(SHAPES.hex, BAR.x + 34, BAR.y + 24, 8), fill: INK.gold }, screen);
    svgText('adamrodwebdev.com', { x: BAR.x + 52, y: BAR.y + 30, class: 'learn-url', fill: INK.cream }, screen);
    const progress = svg('rect', { x: BAR.x, y: BAR.y + BAR.height - 3, width: 0, height: 3, fill: INK.goldHi }, screen);
    return {
      dressedPage,
      progress,
      links: this.#links(screen),
      wait: this.#wait(screen),
      received: this.#received(screen),
      file: this.#file(screen),
      boxes: this.#boxes(screen),
    };
  }

  /**
   * Les trois fichiers arrivés sur l'écran (fin de l'épisode 1) : trois plaques, chacune avec sa forme, son
   * genre et son nom (HTML index.html, CSS style.css, JS script.js), des noms qui se lisent partout.
   */
  #received(parent) {
    return ['html', 'css', 'js'].map((key, k) => {
      const group = svg('g', { opacity: 0 }, parent);
      const top = PAGE.y + 46 + k * 112;
      const left = PAGE.x + 18;
      svg('path', { d: chamfer({ x: left, y: top, width: PAGE.width - 36, height: 88 }, 14), fill: INK.ground, stroke: INK.gold, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, group);
      this.#shape(group, key, left + 40, top + 44, 22);
      svgText(FILES[key].label, { x: left + 78, y: top + 38, class: 'learn-file-label', fill: INK.gold }, group);
      svgText(FILES[key].name, { x: left + 78, y: top + 68, class: 'learn-file-name', fill: INK.cream }, group);
      return group;
    });
  }

  /** Avant la demande : une page de liens (barres d'or) et le doigt qui touche le premier. */
  #links(parent) {
    const group = svg('g', {}, parent);
    for (let k = 0; k < 3; k++) {
      const top = PAGE.y + 36 + k * 92;
      svg('path', { d: chamfer({ x: PAGE.x + 22, y: top, width: 172 - k * 24, height: 14 }, 5), fill: INK.gold }, group);
      svg('rect', { x: PAGE.x + 22, y: top + 26, width: 222, height: 9, fill: INK.faint }, group);
      svg('rect', { x: PAGE.x + 22, y: top + 44, width: 180, height: 9, fill: INK.faint }, group);
    }
    const ripple = svg('polygon', { points: shapePoints(SHAPES.hex, 0, 0, 1), transform: `translate(${PAGE.x + 96} ${PAGE.y + 43}) scale(0)`, fill: INK.goldHi, 'fill-opacity': 0.2, stroke: INK.goldHi, 'stroke-width': 0.09, opacity: 0 }, group);
    return { group, ripple, cx: PAGE.x + 96, cy: PAGE.y + 43 };
  }

  /** L'attente : un arc d'or qui tourne au milieu de la page. */
  #wait(parent) {
    const group = svg('g', { opacity: 0 }, parent);
    const cx = PAGE.x + PAGE.width / 2;
    const cy = PAGE.y + PAGE.height / 2;
    svg('circle', { cx, cy, r: 34, fill: 'none', stroke: INK.faint, 'stroke-width': 7 }, group);
    const arc = svg('path', { d: `M${cx} ${cy - 34} A34 34 0 0 1 ${cx + 34} ${cy}`, fill: 'none', stroke: INK.goldHi, 'stroke-width': 7 }, group);
    return { group, arc, cx, cy };
  }

  /** Le fichier index.html tel qu'il arrive (épisode 2) : du texte, des étiquettes d'or. */
  #file(parent) {
    const group = svg('g', { opacity: 0 }, parent);
    const rows = CODE.map(([open, content, close], k) => {
      const text = svg('text', { x: PAGE.x + 22, y: PAGE.y + 76 + k * 66, class: 'learn-code', opacity: 0 }, group);
      for (const [part, colour] of [[open, INK.gold], [content, INK.cream], [close, INK.gold]]) {
        if (!part) continue;
        const span = svg('tspan', { fill: colour }, text);
        span.textContent = part;
      }
      return text;
    });
    return { group, rows };
  }

  /** Les quatre boîtes de la page (épisode 2) : brutes (pointillés), habillées, puis vivantes. */
  #boxes(parent) {
    const group = svg('g', { opacity: 0 }, parent);
    const items = BOXES.map((box) => {
      const item = svg('g', {}, group);
      const outline = svg('rect', { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8, fill: 'none', stroke: INK.muted, 'stroke-width': 2, 'stroke-dasharray': '7 5' }, item);
      const parts = this.#boxContent(box, item);
      const badge = svg('g', {}, item);
      const width = 16 + box.tag.length * 10;
      const badgeRect = svg('path', { d: chamfer({ x: box.x + box.width - width + 6, y: box.y - 16, width, height: 24 }, 6), fill: FILES.html.fill }, badge);
      svgText(box.tag, { x: box.x + box.width - width / 2 + 6, y: box.y + 1, class: 'learn-badge', fill: INK.ground, 'text-anchor': 'middle' }, badge);
      return { box, item, outline, badge, badgeRect, ...parts };
    });
    return { group, items };
  }

  /** Le contenu d'une boîte, selon sa balise. */
  #boxContent(box, parent) {
    if (box.tag === 'h1') {
      return { bars: [svg('rect', { x: box.x + 6, y: box.y + 14, width: 168, height: 24, fill: INK.cream }, parent)] };
    }
    if (box.tag === 'p') {
      return { bars: [216, 196, 132].map((width, k) => svg('rect', { x: box.x + 6, y: box.y + 10 + k * 20, width, height: 9, fill: INK.muted }, parent)) };
    }
    if (box.tag === 'img') {
      const picture = svg('g', { 'clip-path': 'url(#learn-picture)' }, parent);
      svg('rect', { x: box.x, y: box.y, width: box.width, height: box.height, fill: INK.plate }, picture);
      svg('polygon', { points: shapePoints(SHAPES.hex, box.x + 180, box.y + 34, 16), fill: INK.gold }, picture);
      svg('path', { d: `M${box.x} ${box.y + 90} L${box.x + 70} ${box.y + 52} L${box.x + 130} ${box.y + 84} L${box.x + 236} ${box.y + 64} V${box.y + 116} H${box.x}Z`, fill: INK.goldDeep }, picture);
      svg('path', { d: `M${box.x} ${box.y + 104} L${box.x + 90} ${box.y + 80} L${box.x + 160} ${box.y + 100} L${box.x + 236} ${box.y + 90} V${box.y + 116} H${box.x}Z`, fill: INK.goldDeep, 'fill-opacity': 0.6 }, picture);
      return { bars: [] };
    }
    const button = svg('path', { d: chamfer(box, 10), fill: INK.plateHi, stroke: INK.muted, 'stroke-width': 1.5 }, parent);
    const heart = svgText('♥', { x: box.x + box.width / 2, y: box.y + 34, class: 'learn-heart', fill: INK.cream, 'text-anchor': 'middle' }, parent);
    const count = svgText('', { x: box.x + box.width + 22, y: box.y + 34, class: 'learn-count', fill: INK.cream }, parent);
    return { bars: [], button, heart, count };
  }

  /**
   * Le jeton qui voyage : un hexagone d'or et son « ? » (la demande), le mot « PAGE ? » qui se brise en
   * bits (le binaire), ou une plaque et son nom (épisode 2).
   */
  #token() {
    const group = svg('g', { opacity: 0 }, this.root);
    const mark = svg('g', {}, group);
    svg('polygon', { points: shapePoints(SHAPES.hex, 0, 0, 30), fill: INK.goldHi }, mark);
    const markLabel = svgText('?', { x: 0, y: 13, class: 'learn-mark', fill: INK.ground, 'text-anchor': 'middle' }, mark);
    // Le filet qui relie le paquet à la tête de la ligne (une légende, comme dans une interface augmentée).
    const leader = svg('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: INK.gold, 'stroke-width': 2, 'stroke-opacity': 0.8 }, group);
    const word = svg('g', {}, group);
    const bits = BIT_PLACES.map(([x, y]) => svgText('', { x, y, class: 'learn-bits', fill: INK.gold, 'text-anchor': 'middle' }, word));
    // La plaque sépare le mot de la ligne et de sa plume qu'il chevauche.
    svg('path', { class: 'learn-packet', d: chamfer(WORD_PLATE, 18), fill: INK.ground, 'fill-opacity': 0.86, stroke: INK.gold, 'stroke-opacity': 0.5, 'stroke-width': 2 }, word);
    const wordText = svgText('', { x: 0, y: 22, class: 'learn-word frac-0', fill: 'url(#learn-gold)', 'text-anchor': 'middle' }, word);
    const pill = svg('g', {}, group);
    const pillBody = svg('path', { d: chamfer({ x: -60, y: -21, width: 120, height: 42 }, 10), fill: INK.goldHi }, pill);
    const pillLabel = svgText('', { x: 0, y: 8, class: 'learn-token', fill: INK.ground, 'text-anchor': 'middle' }, pill);
    return { group, mark, markLabel, leader, word, wordText, bits, pill, pillBody, pillLabel };
  }

  /** Peint un état (calculé par la mise en scène) : caméra, lignes, stations, serveur, jeton, écran. */
  apply(state) {
    const { camera } = state;
    const box = [camera.x, camera.y, camera.width, camera.height].map(fixed);
    this.root.setAttribute('viewBox', box.join(' '));
    // Le masque de la grille suit le cadre : elle s'efface toujours vers le bas de l'image.
    this.gridMask.setAttribute('x', box[0]);
    this.gridMask.setAttribute('y', box[1]);
    this.gridMask.setAttribute('width', box[2]);
    this.gridMask.setAttribute('height', box[3]);
    for (const [key, view] of Object.entries(this.lines)) {
      const line = state.lines[key];
      view.reveal.setAttribute('stroke-dashoffset', fixed(view.length * (1 - line.drawn)));
      const drawing = line.drawn > 0 && line.drawn < 1;
      view.pen.setAttribute('opacity', drawing ? 1 : 0);
      if (drawing) {
        const [hx, hy] = pointAlong(view.points, line.drawn);
        view.pen.setAttribute('transform', `translate(${fixed(hx)} ${fixed(hy)})`);
      }
    }
    for (const [key, station] of Object.entries(this.stations)) {
      const lit = state.stations[key];
      station.body.setAttribute('fill', mix(INK.plate, INK.gold, lit));
      station.halo.setAttribute('fill-opacity', fixed(0.24 * state.flash[key]));
    }
    this.server.leds.forEach((led, k) => led.setAttribute('opacity', fixed(state.server.leds[k] ?? 0.35)));
    // Les parties qu'un épisode n'emploie pas restent cachées : chaque mise en scène ne donne que les siennes.
    this.#applyNetwork(state.network ?? null);
    this.#applyDayNight(state.dayNight ?? null);
    this.#applyTray(state.tray ?? null);
    this.#applyDocs(state.docs ?? {});
    this.#applyToken(state.token ?? null);
    this.#applyScreen({ ...SCREEN_DEFAULTS, ...state.screen });
  }

  /** Internet ouvert : apparition des appareils, câbles tracés, ondes, et messages qui filent sur les câbles. */
  #applyNetwork(network) {
    const { group, links, waves, nodes } = this.network;
    group.setAttribute('opacity', fixed(network ? network.shown : 0));
    if (!network) return;
    links.forEach((link, k) => {
      link.line.setAttribute('stroke-dashoffset', fixed(link.length * (1 - network.drawn)));
      // Un message par câble, décalé d'un câble à l'autre : il va et vient tant que le réseau est ouvert.
      const f = (network.flow + k * 0.37) % 1;
      const along = f < 0.5 ? f * 2 : 2 - f * 2;
      link.pulse.setAttribute('transform', `translate(${fixed(lerp(link.a.x, link.b.x, along))} ${fixed(lerp(link.a.y, link.b.y, along))})`);
      link.pulse.setAttribute('opacity', fixed(network.drawn >= 1 ? network.shown : 0));
    });
    waves.forEach((arcs) => arcs.setAttribute('opacity', fixed(network.waves)));
    nodes.forEach((node, k) => {
      const s = Math.min(1, Math.max(0, network.drawn * 1.6 - k * 0.1));
      node.setAttribute('opacity', fixed(s));
    });
  }

  /** Le soleil et la lune au-dessus du serveur : `night` va de 0 (jour) à 1 (nuit). */
  #applyDayNight(dayNight) {
    const { group, sun, moon } = this.dayNight;
    group.setAttribute('opacity', fixed(dayNight ? dayNight.shown : 0));
    if (!dayNight) return;
    sun.setAttribute('opacity', fixed(1 - dayNight.night));
    moon.setAttribute('opacity', fixed(dayNight.night));
  }

  /** Le plateau : chaque fichier glisse de la baie (au-dessus) jusqu'à sa place sur le plateau. */
  #applyTray(tray) {
    const { group, docs } = this.tray;
    group.setAttribute('opacity', fixed(tray ? tray.shown : 0));
    if (!tray) return;
    docs.forEach((doc, k) => {
      const f = tray.docs[k] ?? 0;
      const x = TRAY.x + 30 + k * 40;
      const y = lerp(SERVER.y + SERVER.height - 40, TRAY.y - DOC.height / 2 - 3, f);
      doc.setAttribute('transform', `translate(${fixed(x)} ${fixed(y)})`);
      doc.setAttribute('opacity', fixed(Math.min(1, f * 3)));
    });
  }

  /** Les fichiers qui reviennent au téléphone, chacun sur sa ligne. */
  #applyDocs(docs) {
    for (const [key, group] of Object.entries(this.docs)) {
      const doc = docs[key];
      if (!doc) {
        group.setAttribute('opacity', 0);
        continue;
      }
      const [x, y] = pointAlong(this.lines[key].points, doc.along);
      group.setAttribute('opacity', fixed(Math.min(1, doc.scale * 1.5)));
      group.setAttribute('transform', `translate(${fixed(x)} ${fixed(y)}) scale(${fixed(doc.scale)})`);
    }
  }

  /**
   * Le jeton : sa forme (`mark` l'hexagone et son « ? », `word` le mot qui se brise, sinon une plaque et son
   * nom), sa place sur sa ligne, sa taille. Le mot porte sa valeur FRAC en classe (`frac-…`), et ses bits
   * apparaissent quand il est brisé.
   */
  #applyToken(token) {
    const { group, mark, markLabel, leader, word, wordText, bits, pill, pillBody, pillLabel } = this.token;
    if (!token) {
      group.setAttribute('opacity', 0);
      return;
    }
    const form = token.form ?? 'pill';
    mark.setAttribute('opacity', form === 'mark' ? 1 : 0);
    word.setAttribute('opacity', form === 'word' ? 1 : 0);
    leader.setAttribute('opacity', form === 'word' ? 1 : 0);
    pill.setAttribute('opacity', form === 'pill' ? 1 : 0);
    if (form === 'mark') {
      if (markLabel.textContent !== token.label) markLabel.textContent = token.label;
    } else if (form === 'word') {
      if (wordText.textContent !== token.label) wordText.textContent = token.label;
      const { dx, dy } = token.packet ?? { dx: 0, dy: 0 };
      word.setAttribute('transform', `translate(${fixed(dx)} ${fixed(dy)}) scale(${PACKET.scale})`);
      // Du centre de la tête au bord haut de la plaque.
      leader.setAttribute('x2', fixed(dx));
      leader.setAttribute('y2', fixed(dy + WORD_PLATE.y * PACKET.scale));
      setClass(wordText, `learn-word ${fracClass(token.frac)}`);
      bits.forEach((bit, k) => {
        const value = token.bytes[k] ?? '';
        if (bit.textContent !== value) bit.textContent = value;
        bit.setAttribute('opacity', fixed(token.bits));
      });
    } else {
      if (pillLabel.textContent !== token.label) pillLabel.textContent = token.label;
      const width = 30 + token.label.length * 13;
      pillBody.setAttribute('d', chamfer({ x: -width / 2, y: -21, width, height: 42 }, 10));
    }
    const [ax, ay] = pointAlong(this.lines[token.line].points, token.along);
    group.setAttribute('opacity', fixed(Math.min(1, token.scale * 1.5)));
    // `scale` fait apparaître et effacer le jeton ; `size` grossit le « ? » (épisode 1).
    group.setAttribute('transform', `translate(${fixed(ax)} ${fixed(ay)}) scale(${fixed(token.scale * (token.size ?? 1))})`);
  }

  #applyScreen(screen) {
    const { links, wait, received, file, boxes, dressedPage, progress } = this.phone;
    received.forEach((doc, k) => {
      const f = screen.received[k] ?? 0;
      doc.setAttribute('opacity', fixed(Math.min(1, f * 1.5)));
      doc.setAttribute('transform', `translate(0 ${fixed(-30 * (1 - f))})`);
    });
    links.group.setAttribute('opacity', fixed(screen.links));
    links.ripple.setAttribute('transform', `translate(${links.cx} ${links.cy}) scale(${fixed(screen.ripple.r)})`);
    links.ripple.setAttribute('opacity', fixed(screen.ripple.opacity));
    progress.setAttribute('width', fixed(BAR.width * screen.loading));
    wait.group.setAttribute('opacity', fixed(screen.wait));
    wait.arc.setAttribute('transform', `rotate(${fixed(screen.spin)} ${wait.cx} ${wait.cy})`);
    file.group.setAttribute('opacity', fixed(screen.file));
    file.rows.forEach((row, k) => row.setAttribute('opacity', fixed(screen.code[k] ?? 0)));
    boxes.group.setAttribute('opacity', fixed(screen.page));
    dressedPage.setAttribute('opacity', fixed(screen.dress));
    this.pictureClip.setAttribute('rx', fixed(14 * screen.dress));
    boxes.items.forEach((item, k) => this.#applyBox(item, screen.boxes[k], screen));
  }

  #applyBox(view, box, screen) {
    const s = box.shown;
    const { x, y, width, height } = view.box;
    const cx = x + width / 2;
    const cy = y + height / 2;
    view.item.setAttribute('opacity', fixed(Math.min(1, s * 1.4)));
    view.item.setAttribute('transform', `translate(${fixed(cx)} ${fixed(cy)}) scale(${fixed(0.6 + 0.4 * s)}) translate(${fixed(-cx)} ${fixed(-cy)})`);
    view.outline.setAttribute('opacity', fixed(1 - screen.dress));
    view.badge.setAttribute('opacity', fixed(screen.badges));
    view.badgeRect.setAttribute('fill', (FILES[screen.badge] ?? FILES.html).fill);
    const d = screen.dress;
    if (view.box.tag === 'h1') {
      view.bars[0].setAttribute('width', fixed(lerp(168, 200, d)));
      view.bars[0].setAttribute('height', fixed(lerp(24, 30, d)));
      view.bars[0].setAttribute('fill', mix(INK.cream, INK.goldHi, d));
    } else if (view.box.tag === 'p') {
      view.bars.forEach((bar) => bar.setAttribute('fill', mix(INK.muted, INK.gold, d * 0.6)));
    } else if (view.box.tag === 'button') {
      view.button.setAttribute('fill', mix(INK.plateHi, INK.gold, d));
      view.button.setAttribute('stroke-opacity', fixed(1 - d));
      view.heart.setAttribute('fill', mix(INK.cream, INK.ground, d));
      const pop = 1 + 0.28 * screen.pop;
      view.heart.setAttribute('transform', `translate(${fixed(cx)} ${fixed(cy)}) scale(${fixed(pop)}) translate(${fixed(-cx)} ${fixed(-cy)})`);
      const count = screen.likes > 0 ? String(screen.likes) : '';
      if (view.count.textContent !== count) view.count.textContent = count;
    }
  }
}
