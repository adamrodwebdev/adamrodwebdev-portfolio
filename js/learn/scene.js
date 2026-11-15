/**
 * La scène de l'épisode 1 (1.14.0) : le monde dessiné une fois en SVG (fond, lignes, stations, globe,
 * serveur, téléphone et son navigateur), puis un état appliqué à chaque image. Elle ne décide rien :
 * la mise en scène (episode01.js) calcule l'état à partir du temps, la scène le peint.
 */
import { BAR, GLOBE, GROUND, INK, LINES, PAGE, PHONE, SCREEN, SERVER, STATIONS, WORLD, linePoints, pointAlong, polylineLength } from './world.js';
import { fixed, svg, svgText } from './svg.js';
import { lerp } from './ease.js';

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
    this.server = this.#server();
    this.phone = this.#phone();
    this.token = this.#token();
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
      file: this.#file(screen),
      boxes: this.#boxes(screen),
    };
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
    this.#applyToken(state.token);
    this.#applyScreen(state.screen);
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
    const { links, wait, file, boxes, dressedPage, progress } = this.phone;
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
