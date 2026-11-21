/**
 * L'habillage d'un épisode (1.19.0), au-dessus de la scène : le titre de la première seconde, la ligne
 * d'état (l'épisode, le battement, n / 6), le panneau d'un changement de battement et le sous-titre sur sa
 * plaque. Il peint l'état que la mise en scène calcule (`direction.chrome(t)`), rien de plus.
 *
 * Le panneau et son numéro sont dans un SVG sans texte d'aucune langue (des chiffres) : l'image reste la
 * même en français et en anglais. Le titre, la ligne d'état et la plaque du sous-titre sont du HTML dans la
 * langue de la page ; le film sans textes (`?film&captions=off`) les cache tous trois. Dans le film, la
 * plaque porte aussi l'étiquette de la série et le pseudo (le kit vidéo), toujours entiers : la page les
 * écrit, le CSS ne les montre qu'en mode film.
 */
import { fracClass } from './frac.js';
import { INK, SHAPES } from './world.js';
import { fixed, shapePoints, svg, svgText } from './svg.js';

/** Le cadre du panneau : celui de l'image, 9:16. */
const FRAME = Object.freeze({ width: 900, height: 1600 });

/**
 * Les deux panneaux, comme les marches du site : la marche qui monte (34 % de la largeur, numéro à droite)
 * et celle qui descend (60 %, numéro à gauche). Le bord haut se pose sous la plaque des sous-titres (vers
 * 31 % de la hauteur) ; le numéro est à cheval sur ce bord, comme ceux du site, et se lit d'un coup d'œil.
 */
const PANELS = Object.freeze({
  rise: Object.freeze({ plate: 'M0 540H306L346 500H900V1600H0Z', edge: 'M0 540H306L346 500H900', index: { x: 870, y: 840, anchor: 'end' }, shard: { x: 270, y: 472, angle: 18 } }),
  fall: Object.freeze({ plate: 'M0 460H540L580 500H900V1600H0Z', edge: 'M0 460H540L580 500H900', index: { x: 30, y: 820, anchor: 'start' }, shard: { x: 618, y: 448, angle: -24 } }),
});

/** Pose une classe ou un texte seulement s'ils changent : une valeur qui ne bouge pas ne coûte rien. */
function setClass(element, value) {
  if (element.getAttribute('class') !== value) element.setAttribute('class', value);
}
function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}
const twoDigits = (n) => String(n).padStart(2, '0');

export class Chrome {
  /**
   * @param {{
   *   overlay: SVGSVGElement,
   *   title: HTMLElement | null, titleSeries: HTMLElement | null,
   *   status: HTMLElement | null, statusBeat: HTMLElement | null, statusCount: HTMLElement | null,
   *   plate: HTMLElement | null, caption: HTMLElement | null,
   *   texts: { captions: readonly string[], beats: readonly string[] },
   * }} parts  les éléments de la page (absents : rien à peindre) et les textes de sa langue, lus à la porte
   */
  constructor({ overlay, title, titleSeries, status, statusBeat, statusCount, plate, caption, texts }) {
    this.parts = { title, titleSeries, status, statusBeat, statusCount, plate, caption };
    this.texts = texts;
    this.panels = this.#panels(overlay);
  }

  #panels(overlay) {
    overlay.setAttribute('viewBox', `0 0 ${FRAME.width} ${FRAME.height}`);
    overlay.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const defs = svg('defs', {}, overlay);
    const plate = svg('linearGradient', { id: 'learn-plate', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': INK.plateHi }, plate);
    svg('stop', { offset: 0.5, 'stop-color': INK.ground }, plate);
    const index = svg('linearGradient', { id: 'learn-index', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': INK.gold, 'stop-opacity': 0.42 }, index);
    svg('stop', { offset: 0.8, 'stop-color': INK.gold, 'stop-opacity': 0 }, index);
    return Object.fromEntries(Object.entries(PANELS).map(([kind, shape]) => {
      const group = svg('g', { opacity: 0 }, overlay);
      svg('path', { d: shape.plate, fill: 'url(#learn-plate)' }, group);
      svg('path', { d: shape.edge, fill: 'none', stroke: INK.goldHi, 'stroke-width': 4 }, group);
      const number = svgText('', { x: shape.index.x, y: shape.index.y, 'text-anchor': shape.index.anchor, class: 'learn-index frac-35', fill: 'url(#learn-index)' }, group);
      const { x, y, angle } = shape.shard;
      svg('polygon', { points: shapePoints(SHAPES.shard, x, y, 20), fill: INK.gold, transform: `rotate(${angle} ${x} ${y})` }, group);
      return [kind, { group, number }];
    }));
  }

  /** Peint l'habillage d'un instant : `{ title, status, panel, caption }` (episode01.js, `chrome(t)`). */
  apply({ title, status, panel, caption }) {
    const { title: card, titleSeries, status: line, statusBeat, statusCount, plate, caption: words } = this.parts;
    if (card) card.hidden = !title.shown;
    if (titleSeries) setClass(titleSeries, `learn-titlecard__series ${fracClass(title.frac)}`);
    if (line) line.hidden = !status.shown;
    if (statusBeat) setText(statusBeat, this.texts.beats[status.index] ?? '');
    if (statusCount) setText(statusCount, `${twoDigits(status.index + 1)} / ${twoDigits(this.texts.beats.length)}`);
    for (const [kind, view] of Object.entries(this.panels)) {
      const shown = panel !== null && panel.kind === kind;
      view.group.setAttribute('opacity', shown ? 1 : 0);
      if (!shown) continue;
      view.group.setAttribute('transform', `translate(0 ${fixed(panel.offset * FRAME.height)})`);
      setText(view.number, twoDigits(panel.number));
      setClass(view.number, `learn-index ${fracClass(panel.frac)}`);
    }
    if (words) {
      const text = caption ? (this.texts.captions[caption.index] ?? '') : '';
      setText(words, text);
      setClass(words, `learn-caption ${fracClass(caption ? caption.frac : 0)}`);
      if (plate) plate.hidden = text === '';
    }
  }
}
