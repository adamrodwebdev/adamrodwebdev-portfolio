/**
 * La scène de l'épisode 1 (1.19.0) : le monde dessiné une fois en SVG (fond, lignes, stations, globe,
 * serveur, téléphone et son navigateur), puis un état appliqué à chaque image. Elle ne décide rien :
 * la mise en scène (episode01.js) calcule l'état à partir du temps, la scène le peint.
 */
import { BAR, DAY_NIGHT, DOC, GLOBE, GROUND, INK, LINES, NETWORK, PAGE, PHONE, SCREEN, SERVER, STATIONS, TRAY, WORLD, linePoints, pointAlong, polylineLength } from './world.js';
import { fixed, svg, svgText } from './svg.js';
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

/** La couleur d'un document, celle de la ligne qui le porte. */
const DOC_COLOURS = Object.freeze({ html: '#ff4b44', css: '#4d86ff', js: '#ffb400' });

/** Les boîtes de la page qui se construit, dans la zone de la page. */
const BOXES = Object.freeze([
  Object.freeze({ tag: 'h1', x: 212, y: 828, width: 236, height: 52 }),
  Object.freeze({ tag: 'p', x: 212, y: 902, width: 236, height: 70 }),
  Object.freeze({ tag: 'img', x: 212, y: 994, width: 236, height: 116 }),
  Object.freeze({ tag: 'button', x: 212, y: 1134, width: 112, height: 50 }),
]);

/** Le code du fichier index.html, ligne à ligne : [balise ouvrante, contenu, balise fermante]. */
const CODE = Object.freeze([
  ['<h1>', '…', '</h1>'],
  ['<p>', '…', '</p>'],
  ['<img>', '', ''],
  ['<button>', '♥', '</button>'],
]);

/** La couleur d'une étiquette selon la ligne qui l'a touchée en dernier. */
const BADGE = Object.freeze({ html: '#ff4b44', css: '#4d86ff', js: '#ffb400' });

const toRgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
/** Une couleur entre `a` et `b` (#rrggbb), pour `f` entre 0 et 1. */
const mix = (a, b, f) => `rgb(${toRgb(a).map((v, i) => Math.round(lerp(v, toRgb(b)[i], f))).join(' ')})`;

export class Scene {
  /** @param {SVGSVGElement} root l'élément <svg> de la scène, vide */
  constructor(root) {
    this.root = root;
    root.setAttribute('viewBox', `0 0 ${WORLD.width} ${WORLD.height}`);
    root.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    this.#defs();
    this.#ground();
    this.lines = Object.fromEntries(LINES.map((line) => [line.key, this.#line(line)]));
    this.stations = this.#stations();
    this.#globe();
    this.network = this.#network();
    this.server = this.#server();
    this.dayNight = this.#dayNight();
    this.tray = this.#tray();
    this.phone = this.#phone();
    this.docs = this.#docs();
    this.token = this.#token();
  }

  /** Un document : une feuille au coin plié, de la couleur de sa ligne, deux traits pour son texte. Centré sur 0. */
  #document(parent, colour) {
    const { width: w, height: h, fold: f } = DOC;
    const group = svg('g', {}, parent);
    svg('path', { d: `M${-w / 2} ${-h / 2}h${w - f}l${f} ${f}v${h - f}h${-w}Z`, fill: colour, stroke: INK.ground, 'stroke-width': 3, 'stroke-linejoin': 'round' }, group);
    svg('path', { d: `M${w / 2 - f} ${-h / 2}v${f}h${f}`, fill: 'none', stroke: INK.ground, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, group);
    for (const [y, length] of [[-3, 18], [6, 12]]) svg('line', { x1: -w / 2 + 6, y1: y, x2: -w / 2 + 6 + length, y2: y, stroke: INK.ground, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-opacity': 0.55 }, group);
    return group;
  }

  /**
   * Internet, ouvert : des appareils (téléphones, portables, serveurs) reliés par des câbles que la
   * plume trace, des ondes radio autour des téléphones, et des messages qui filent sur les câbles.
   */
  #network() {
    const group = svg('g', { opacity: 0 }, this.root);
    const at = (id) => (id === 'globe' ? { x: GLOBE.x, y: GLOBE.y } : NETWORK.nodes.find((node) => node.id === id));
    const links = NETWORK.links.map(([from, to]) => {
      const a = at(from);
      const b = at(to);
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const line = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: INK.cream, 'stroke-width': 3, 'stroke-opacity': 0.55, 'stroke-dasharray': `${fixed(length)} ${fixed(length)}`, 'stroke-dashoffset': fixed(length) }, group);
      const pulse = svg('circle', { r: 5, fill: '#22c37b', opacity: 0 }, group);
      return { a, b, length, line, pulse };
    });
    const waves = NETWORK.waves.map((id) => {
      const node = at(id);
      const arcs = svg('g', { fill: 'none', stroke: INK.cream, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, group);
      for (const r of [16, 26]) svg('path', { d: `M${node.x + r * 0.7} ${node.y - 22 - r * 0.7}a${r} ${r} 0 0 1 0 ${fixed(r * 1.4)}`, transform: `rotate(-45 ${node.x} ${node.y - 22})` }, arcs);
      return arcs;
    });
    const nodes = NETWORK.nodes.map((node) => {
      const item = svg('g', { transform: `translate(${node.x} ${node.y})` }, group);
      const draw = { fill: INK.groundGlow, stroke: INK.cream, 'stroke-width': 3, 'stroke-linejoin': 'round' };
      if (node.kind === 'phone') {
        svg('rect', { x: -10, y: -17, width: 20, height: 34, rx: 5, ...draw }, item);
      } else if (node.kind === 'laptop') {
        svg('rect', { x: -17, y: -13, width: 34, height: 22, rx: 3, ...draw }, item);
        svg('path', { d: 'M-23 12h46', stroke: INK.cream, 'stroke-width': 4, 'stroke-linecap': 'round' }, item);
      } else {
        svg('rect', { x: -14, y: -19, width: 28, height: 38, rx: 4, ...draw }, item);
        for (const y of [-9, 1, 11]) svg('line', { x1: -7, y1: y, x2: 7, y2: y, stroke: INK.muted, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, item);
      }
      return item;
    });
    return { group, links, waves, nodes };
  }

  /** Le jour et la nuit au-dessus du serveur : un soleil qui devient une lune, et revient. */
  #dayNight() {
    const { x, y, r } = DAY_NIGHT;
    const group = svg('g', { opacity: 0 }, this.root);
    const sun = svg('g', {}, group);
    svg('circle', { cx: x, cy: y, r: r * 0.62, fill: '#ffb400' }, sun);
    for (let k = 0; k < 8; k++) {
      const angle = (k * Math.PI) / 4;
      svg('line', { x1: fixed(x + Math.cos(angle) * r * 0.9), y1: fixed(y + Math.sin(angle) * r * 0.9), x2: fixed(x + Math.cos(angle) * r * 1.3), y2: fixed(y + Math.sin(angle) * r * 1.3), stroke: '#ffb400', 'stroke-width': 3, 'stroke-linecap': 'round' }, sun);
    }
    // Un croissant : le demi-cercle de gauche, refermé par un arc plus plat ; il s'ouvre vers la droite.
    const flat = r * 1.35;
    const moon = svg('path', { d: `M${x} ${y - r}A${r} ${r} 0 0 0 ${x} ${y + r}A${fixed(flat)} ${fixed(flat)} 0 0 1 ${x} ${y - r}Z`, fill: INK.cream }, group);
    return { group, sun, moon };
  }

  /** Le plateau du serveur et ses trois documents, qui glissent hors de la baie. */
  #tray() {
    const group = svg('g', { opacity: 0 }, this.root);
    svg('path', { d: `M${TRAY.x} ${TRAY.y}h${TRAY.width}`, stroke: INK.gold, 'stroke-width': 5, 'stroke-linecap': 'round' }, group);
    svg('path', { d: `M${TRAY.x + 8} ${TRAY.y + 2}l10 10h${TRAY.width - 36}l10 -10`, fill: 'none', stroke: INK.gold, 'stroke-width': 3, 'stroke-linejoin': 'round' }, group);
    const docs = ['html', 'css', 'js'].map((key) => this.#document(group, DOC_COLOURS[key]));
    return { group, docs };
  }

  /** Les trois documents qui reviennent au téléphone, chacun sur sa ligne (rouge, bleue, ambre), sans nom encore. */
  #docs() {
    return Object.fromEntries(['html', 'css', 'js'].map((key) => {
      const group = svg('g', { opacity: 0 }, this.root);
      this.#document(group, DOC_COLOURS[key]);
      return [key, group];
    }));
  }

  #defs() {
    const defs = svg('defs', {}, this.root);
    const glow = svg('radialGradient', { id: 'learn-ground', cx: '50%', cy: '48%', r: '62%' }, defs);
    svg('stop', { offset: '0%', 'stop-color': INK.groundGlow }, glow);
    svg('stop', { offset: '100%', 'stop-color': INK.ground }, glow);
    const dots = svg('pattern', { id: 'learn-paper', width: 30, height: 30, patternUnits: 'userSpaceOnUse' }, defs);
    svg('circle', { cx: 15, cy: 15, r: 1.4, fill: INK.paper, 'fill-opacity': 0.22 }, dots);
    const dressed = svg('linearGradient', { id: 'learn-dressed', x1: 0, y1: 0, x2: 0.6, y2: 1 }, defs);
    svg('stop', { offset: '0%', 'stop-color': '#fff4d6' }, dressed);
    svg('stop', { offset: '100%', 'stop-color': '#ffe1e0' }, dressed);
    const screenClip = svg('clipPath', { id: 'learn-screen' }, defs);
    svg('rect', { x: SCREEN.x, y: SCREEN.y, width: SCREEN.width, height: SCREEN.height, rx: SCREEN.radius }, screenClip);
    const picture = svg('clipPath', { id: 'learn-picture' }, defs);
    const img = BOXES[2];
    this.pictureClip = svg('rect', { x: img.x, y: img.y, width: img.width, height: img.height, rx: 0 }, picture);
  }

  #ground() {
    // Le fond noir couvre bien plus que le monde ; la lueur chaude reste centrée sur le plan.
    svg('rect', { ...GROUND, fill: INK.ground }, this.root);
    svg('rect', { width: WORLD.width, height: WORLD.height, fill: 'url(#learn-ground)' }, this.root);
    svg('rect', { ...GROUND, fill: 'url(#learn-paper)' }, this.root);
  }

  /** Une ligne : son fantôme (le tracé à venir), le trait que la plume dessine, la plume. */
  #line(line) {
    const points = linePoints(line);
    const d = `M${points.map((p) => p.map(fixed).join(' ')).join(' L')}`;
    const group = svg('g', { class: `learn-line learn-line--${line.key}` }, this.root);
    svg('path', { d, fill: 'none', stroke: line.colour, 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': 0.13 }, group);
    const path = svg('path', { d, fill: 'none', stroke: line.colour, 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, group);
    // Longueur calculée sur le tracé (segments droits), pas mesurée dans le DOM : la même dans le film et la page.
    const length = polylineLength(points);
    path.setAttribute('stroke-dasharray', `${fixed(length)} ${fixed(length + 40)}`);
    const pen = svg('g', { opacity: 0 }, group);
    svg('circle', { r: 22, fill: line.colour, 'fill-opacity': 0.25 }, pen);
    svg('circle', { r: 10, fill: INK.cream, stroke: line.colour, 'stroke-width': 5 }, pen);
    return { line, points, path, pen, length };
  }

  /** Les stations : une pastille en travers des quatre lignes, sombre puis allumée quand une ligne arrive. */
  #stations() {
    const pill = (x, y, angle) => {
      const group = svg('g', { transform: `rotate(${angle} ${x} ${y})` }, this.root);
      const halo = svg('rect', { x: x - 54, y: y - 24, width: 108, height: 48, rx: 24, fill: INK.cream, 'fill-opacity': 0 }, group);
      const body = svg('rect', { x: x - 44, y: y - 14, width: 88, height: 28, rx: 14, fill: INK.ground, stroke: INK.cream, 'stroke-width': 5 }, group);
      return { halo, body };
    };
    return {
      phone: pill(STATIONS.phone.x, STATIONS.phone.y, 0),
      internet: pill(STATIONS.internet.x, STATIONS.internet.y, 45),
      server: pill(STATIONS.server.x, STATIONS.server.y, 90),
    };
  }

  #globe() {
    const { x, y, r } = GLOBE;
    const group = svg('g', { fill: 'none', stroke: INK.cream, 'stroke-width': 3, 'stroke-opacity': 0.85 }, this.root);
    svg('circle', { cx: x, cy: y, r, fill: INK.groundGlow }, group);
    svg('ellipse', { cx: x, cy: y, rx: r * 0.45, ry: r }, group);
    svg('line', { x1: x - r, y1: y, x2: x + r, y2: y }, group);
    svg('path', { d: `M${x - r * 0.86} ${y - r * 0.5} Q${x} ${y - r * 0.3} ${x + r * 0.86} ${y - r * 0.5}` }, group);
    svg('path', { d: `M${x - r * 0.86} ${y + r * 0.5} Q${x} ${y + r * 0.3} ${x + r * 0.86} ${y + r * 0.5}` }, group);
  }

  /** La baie du serveur : trois unités, chacune avec deux voyants qui clignotent quand il travaille. */
  #server() {
    const { x, y, width, height, units } = SERVER;
    const group = svg('g', {}, this.root);
    svg('rect', { x, y, width, height, rx: 16, fill: INK.groundGlow, stroke: INK.cream, 'stroke-width': 4 }, group);
    const leds = [];
    for (let k = 0; k < units; k++) {
      const top = y + 18 + k * 60;
      svg('rect', { x: x + 16, y: top, width: width - 32, height: 46, rx: 9, fill: INK.ground, stroke: INK.muted, 'stroke-width': 2 }, group);
      for (let s = 0; s < 3; s++) svg('line', { x1: x + 30 + s * 12, y1: top + 12, x2: x + 30 + s * 12, y2: top + 34, stroke: INK.muted, 'stroke-width': 3, 'stroke-linecap': 'round' }, group);
      leds.push(svg('circle', { cx: x + width - 46, cy: top + 23, r: 6, fill: '#22c37b' }, group));
      leds.push(svg('circle', { cx: x + width - 28, cy: top + 23, r: 6, fill: '#ffb400' }, group));
    }
    return { leds };
  }

  /** Le téléphone : son boîtier au liseré d'or, l'écran, la barre du navigateur et les vues de la page. */
  #phone() {
    svg('rect', { x: PHONE.x, y: PHONE.y, width: PHONE.width, height: PHONE.height, rx: PHONE.radius, fill: INK.device, stroke: INK.gold, 'stroke-width': 3 }, this.root);
    const screen = svg('g', { 'clip-path': 'url(#learn-screen)' }, this.root);
    svg('rect', { x: SCREEN.x, y: SCREEN.y, width: SCREEN.width, height: SCREEN.height, fill: INK.page }, screen);
    const dressedPage = svg('rect', { x: PAGE.x, y: PAGE.y, width: PAGE.width, height: PAGE.height, fill: 'url(#learn-dressed)', opacity: 0 }, screen);
    // La barre du navigateur : un cadenas et l'adresse, un nom de domaine qui se lit dans toutes les langues.
    svg('rect', { x: BAR.x, y: BAR.y, width: BAR.width, height: BAR.height, fill: INK.bar }, screen);
    svg('rect', { x: BAR.x + 14, y: BAR.y + 10, width: BAR.width - 28, height: 28, rx: 14, fill: INK.page, stroke: '#e2ddd0', 'stroke-width': 1.5 }, screen);
    svg('path', { d: `M${BAR.x + 32} ${BAR.y + 22}v-3a5 5 0 0 1 10 0v3`, fill: 'none', stroke: '#57514a', 'stroke-width': 2 }, screen);
    svg('rect', { x: BAR.x + 29, y: BAR.y + 21, width: 16, height: 11, rx: 2, fill: '#57514a' }, screen);
    svgText('adamrodwebdev.com', { x: BAR.x + 52, y: BAR.y + 30, class: 'learn-url', fill: '#57514a' }, screen);
    const progress = svg('rect', { x: BAR.x, y: BAR.y + BAR.height - 3, width: 0, height: 3, fill: '#22c37b' }, screen);
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

  /** Les trois documents arrivés sur l'écran (fin de l'épisode 1) : pas encore ouverts. */
  #received(parent) {
    const cy = PAGE.y + PAGE.height / 2;
    return ['html', 'css', 'js'].map((key, k) => {
      const group = svg('g', { opacity: 0 }, parent);
      const inner = svg('g', { transform: `translate(${PAGE.x + PAGE.width / 2 + (k - 1) * 70} ${cy}) scale(1.9)` }, group);
      this.#document(inner, DOC_COLOURS[key]);
      return group;
    });
  }

  /** Avant la demande : une page de liens, et le doigt qui touche le premier. */
  #links(parent) {
    const group = svg('g', {}, parent);
    for (let k = 0; k < 3; k++) {
      const top = PAGE.y + 36 + k * 92;
      svg('rect', { x: PAGE.x + 22, y: top, width: 172 - k * 24, height: 14, rx: 7, fill: '#0a5cff' }, group);
      svg('rect', { x: PAGE.x + 22, y: top + 26, width: 222, height: 9, rx: 4.5, fill: '#d9dce1' }, group);
      svg('rect', { x: PAGE.x + 22, y: top + 44, width: 180, height: 9, rx: 4.5, fill: '#d9dce1' }, group);
    }
    const ripple = svg('circle', { cx: PAGE.x + 96, cy: PAGE.y + 43, r: 0, fill: '#0a5cff', 'fill-opacity': 0.25, stroke: '#0a5cff', 'stroke-width': 3, opacity: 0 }, group);
    return { group, ripple };
  }

  /** L'attente : un arc qui tourne au milieu de la page. */
  #wait(parent) {
    const group = svg('g', { opacity: 0 }, parent);
    const cx = PAGE.x + PAGE.width / 2;
    const cy = PAGE.y + PAGE.height / 2;
    svg('circle', { cx, cy, r: 34, fill: 'none', stroke: '#e2e4e8', 'stroke-width': 7 }, group);
    const arc = svg('path', { d: `M${cx} ${cy - 34} A34 34 0 0 1 ${cx + 34} ${cy}`, fill: 'none', stroke: '#22c37b', 'stroke-width': 7, 'stroke-linecap': 'round' }, group);
    return { group, arc, cx, cy };
  }

  /** Le fichier index.html tel qu'il arrive : du texte, des étiquettes. */
  #file(parent) {
    const group = svg('g', { opacity: 0 }, parent);
    const rows = CODE.map(([open, content, close], k) => {
      const text = svg('text', { x: PAGE.x + 22, y: PAGE.y + 76 + k * 66, class: 'learn-code', opacity: 0 }, group);
      for (const [part, colour] of [[open, '#e6261f'], [content, INK.pageInk], [close, '#e6261f']]) {
        if (!part) continue;
        const span = svg('tspan', { fill: colour }, text);
        span.textContent = part;
      }
      return text;
    });
    return { group, rows };
  }

  /** Les quatre boîtes de la page : brutes (pointillés, sans style), habillées, puis vivantes. */
  #boxes(parent) {
    const group = svg('g', { opacity: 0 }, parent);
    const items = BOXES.map((box) => {
      const item = svg('g', {}, group);
      const outline = svg('rect', { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8, rx: 4, fill: 'none', stroke: '#9aa0a8', 'stroke-width': 2, 'stroke-dasharray': '7 5' }, item);
      const parts = this.#boxContent(box, item);
      const badge = svg('g', {}, item);
      const width = 16 + box.tag.length * 10;
      const badgeRect = svg('rect', { x: box.x + box.width - width + 6, y: box.y - 16, width, height: 24, rx: 7, fill: BADGE.html }, badge);
      svgText(box.tag, { x: box.x + box.width - width / 2 + 6, y: box.y + 1, class: 'learn-badge', fill: INK.page, 'text-anchor': 'middle' }, badge);
      return { box, item, outline, badge, badgeRect, ...parts };
    });
    return { group, items };
  }

  /** Le contenu d'une boîte, selon sa balise. */
  #boxContent(box, parent) {
    if (box.tag === 'h1') {
      return { bars: [svg('rect', { x: box.x + 6, y: box.y + 14, width: 168, height: 24, rx: 2, fill: INK.pageInk }, parent)] };
    }
    if (box.tag === 'p') {
      return { bars: [216, 196, 132].map((width, k) => svg('rect', { x: box.x + 6, y: box.y + 10 + k * 20, width, height: 9, rx: 1, fill: INK.pageMuted }, parent)) };
    }
    if (box.tag === 'img') {
      const picture = svg('g', { 'clip-path': 'url(#learn-picture)' }, parent);
      svg('rect', { x: box.x, y: box.y, width: box.width, height: box.height, fill: '#bfe3ff' }, picture);
      svg('circle', { cx: box.x + 180, cy: box.y + 34, r: 16, fill: '#ffb400' }, picture);
      svg('path', { d: `M${box.x} ${box.y + 90} Q${box.x + 60} ${box.y + 50} ${box.x + 118} ${box.y + 82} T${box.x + 236} ${box.y + 72} V${box.y + 116} H${box.x}Z`, fill: '#00a05a' }, picture);
      svg('path', { d: `M${box.x} ${box.y + 104} Q${box.x + 74} ${box.y + 78} ${box.x + 148} ${box.y + 100} T${box.x + 236} ${box.y + 94} V${box.y + 116} H${box.x}Z`, fill: '#00804a' }, picture);
      return { bars: [] };
    }
    const button = svg('rect', { x: box.x, y: box.y, width: box.width, height: box.height, rx: 3, fill: '#efefef', stroke: '#767676', 'stroke-width': 1.5 }, parent);
    const heart = svgText('♥', { x: box.x + box.width / 2, y: box.y + 34, class: 'learn-heart', fill: INK.pageInk, 'text-anchor': 'middle' }, parent);
    const count = svgText('', { x: box.x + box.width + 22, y: box.y + 34, class: 'learn-count', fill: '#40444b' }, parent);
    return { bars: [], button, heart, count };
  }

  /** Le jeton qui voyage : une pastille de la couleur de sa ligne, avec son nom. */
  #token() {
    const group = svg('g', { opacity: 0 }, this.root);
    const pill = svg('rect', { x: -60, y: -21, width: 120, height: 42, rx: 21, stroke: INK.ground, 'stroke-width': 4 }, group);
    const label = svgText('', { x: 0, y: 8, class: 'learn-token', fill: '#0a0a0a', 'text-anchor': 'middle' }, group);
    return { group, pill, label };
  }

  /** Peint un état (calculé par la mise en scène) : caméra, lignes, stations, serveur, jeton, écran. */
  apply(state) {
    const { camera } = state;
    this.root.setAttribute('viewBox', [camera.x, camera.y, camera.width, camera.height].map(fixed).join(' '));
    for (const [key, view] of Object.entries(this.lines)) {
      const line = state.lines[key];
      view.path.setAttribute('stroke-dashoffset', fixed(view.length * (1 - line.drawn)));
      const drawing = line.drawn > 0 && line.drawn < 1;
      view.pen.setAttribute('opacity', drawing ? 1 : 0);
      if (drawing) {
        const [hx, hy] = pointAlong(view.points, line.drawn);
        view.pen.setAttribute('transform', `translate(${fixed(hx)} ${fixed(hy)})`);
      }
    }
    for (const [key, station] of Object.entries(this.stations)) {
      const lit = state.stations[key];
      station.body.setAttribute('fill', mix(INK.ground, INK.cream, lit));
      station.halo.setAttribute('fill-opacity', fixed(0.22 * state.flash[key]));
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
      link.pulse.setAttribute('cx', fixed(lerp(link.a.x, link.b.x, along)));
      link.pulse.setAttribute('cy', fixed(lerp(link.a.y, link.b.y, along)));
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

  /** Le plateau : chaque document glisse de la baie (au-dessus) jusqu'à sa place sur le plateau. */
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

  /** Les documents qui reviennent au téléphone, chacun sur sa ligne. */
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

  #applyToken(token) {
    const { group, pill, label } = this.token;
    if (!token) {
      group.setAttribute('opacity', 0);
      return;
    }
    const view = this.lines[token.line];
    const [ax, ay] = pointAlong(view.points, token.along);
    if (label.textContent !== token.label) label.textContent = token.label;
    const width = 30 + token.label.length * 13;
    pill.setAttribute('x', fixed(-width / 2));
    pill.setAttribute('width', fixed(width));
    pill.setAttribute('fill', view.line.colour);
    group.setAttribute('opacity', fixed(Math.min(1, token.scale * 1.5)));
    group.setAttribute('transform', `translate(${fixed(ax)} ${fixed(ay)}) scale(${fixed(token.scale)})`);
  }

  #applyScreen(screen) {
    const { links, wait, received, file, boxes, dressedPage, progress } = this.phone;
    received.forEach((doc, k) => {
      const f = screen.received[k] ?? 0;
      doc.setAttribute('opacity', fixed(Math.min(1, f * 1.5)));
      doc.setAttribute('transform', `translate(0 ${fixed(18 * (1 - f))})`);
    });
    links.group.setAttribute('opacity', fixed(screen.links));
    links.ripple.setAttribute('r', fixed(screen.ripple.r));
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
    view.badgeRect.setAttribute('fill', BADGE[screen.badge] ?? BADGE.html);
    const d = screen.dress;
    if (view.box.tag === 'h1') {
      view.bars[0].setAttribute('width', fixed(lerp(168, 200, d)));
      view.bars[0].setAttribute('height', fixed(lerp(24, 30, d)));
      view.bars[0].setAttribute('rx', fixed(lerp(2, 8, d)));
      view.bars[0].setAttribute('fill', mix(INK.pageInk, '#1d1d1f', d));
    } else if (view.box.tag === 'p') {
      view.bars.forEach((bar) => {
        bar.setAttribute('fill', mix(INK.pageMuted, '#b98b6e', d));
        bar.setAttribute('rx', fixed(lerp(1, 4.5, d)));
      });
    } else if (view.box.tag === 'button') {
      view.button.setAttribute('fill', mix('#efefef', '#e6261f', d));
      view.button.setAttribute('stroke-opacity', fixed(1 - d));
      view.button.setAttribute('rx', fixed(lerp(3, height / 2, d)));
      view.heart.setAttribute('fill', mix(INK.pageInk, INK.page, d));
      const pop = 1 + 0.28 * screen.pop;
      view.heart.setAttribute('transform', `translate(${fixed(cx)} ${fixed(cy)}) scale(${fixed(pop)}) translate(${fixed(-cx)} ${fixed(-cy)})`);
      const count = screen.likes > 0 ? String(screen.likes) : '';
      if (view.count.textContent !== count) view.count.textContent = count;
    }
  }
}
