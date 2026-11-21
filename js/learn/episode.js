/**
 * Un épisode (1.19.0) : sa scène, sa mise en scène et son habillage (titre, ligne d'état, panneaux,
 * sous-titres). `render(t)` dessine l'instant t, et le même t dessine toujours la même image : le film se
 * tourne image par image, dans n'importe quel ordre, et la page interactive se joue avec la même fonction.
 */
import { Scene } from './scene.js';

export class Episode {
  /**
   * @param {{ svg: SVGSVGElement, direction: import('./episode01.js').Direction,
   *   chrome?: import('./chrome.js').Chrome | null }} parts
   *   `chrome` : l'habillage peint au-dessus de la scène (absent : la scène seule)
   */
  constructor({ svg, direction, chrome = null }) {
    this.scene = new Scene(svg);
    this.direction = direction;
    this.chrome = chrome;
    this.captionTimes = direction.captions();
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
  }

  /** Dessine l'instant `t` (secondes), ramené dans la durée de l'épisode : la scène, puis son habillage. */
  render(t) {
    const time = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), this.duration);
    this.scene.apply(this.direction.state(time));
    if (this.chrome) this.chrome.apply(this.direction.chrome(time));
  }
}
