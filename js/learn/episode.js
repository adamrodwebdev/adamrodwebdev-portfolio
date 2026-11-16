/**
 * Un épisode (1.14.0) : sa scène, sa mise en scène et, dans la page, ses sous-titres. `render(t)` dessine
 * l'instant t, et le même t dessine toujours la même image : le film se tourne image par image, dans
 * n'importe quel ordre, et la page interactive se joue avec la même fonction.
 */
import { Scene } from './scene.js';

export class Episode {
  /**
   * @param {{ svg: SVGSVGElement, direction: import('./episode01.js').Direction,
   *   caption?: HTMLElement | null, captions?: readonly string[] }} parts
   *   `caption` : l'élément des sous-titres de la page (absent du film : l'habillage les dessine par langue)
   */
  constructor({ svg, direction, caption = null, captions = [] }) {
    this.scene = new Scene(svg);
    this.direction = direction;
    this.caption = caption;
    this.captionTexts = captions;
    this.captionTimes = direction.captions();
    this.shown = -2;
  }

  get duration() {
    return this.direction.duration;
  }

  /** Les battements de l'épisode : { id, start, end } en secondes. */
  get beats() {
    return this.direction.timeline.beats;
  }

  /** Le même épisode sur d'autres battements (la voix les fixe) : la scène reste, la mise en scène change. */
  retime(direction) {
    this.direction = direction;
    this.captionTimes = direction.captions();
    this.shown = -2;
  }

  /** Dessine l'instant `t` (secondes), ramené dans la durée de l'épisode. */
  render(t) {
    const time = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), this.duration);
    this.scene.apply(this.direction.state(time));
    if (this.caption) this.#caption(time);
  }

  /** Le sous-titre de l'instant `t` ; le texte ne change dans le DOM que s'il change à l'écran. */
  #caption(t) {
    const active = this.captionTimes.find((caption) => t >= caption.start && t < caption.end);
    const index = active ? active.index : -1;
    if (index === this.shown) return;
    this.shown = index;
    this.caption.textContent = index >= 0 ? (this.captionTexts[index] ?? '') : '';
  }
}
