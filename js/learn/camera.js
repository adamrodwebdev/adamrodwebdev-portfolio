/**
 * La caméra des épisodes (1.14.0) : une suite de plans, chacun cadré par une fonction du temps (fixe, ou
 * qui suit le jeton), fondus l'un dans l'autre. Elle rend un viewBox en 9:16, gardé dans le monde.
 */
import { EASE, lerp, phase } from './ease.js';
import { WORLD } from './world.js';

/** Hauteur sur largeur d'une image d'épisode (9:16). */
export const ASPECT = 16 / 9;

/**
 * Où se tient le sujet dans la hauteur de l'image : entre la bande des sous-titres en haut et la
 * légende et les boutons des applis en bas (au-delà de 78 %).
 */
export const FOCUS = 0.52;

/** La largeur la plus grande d'un cadrage : le plan large recule un peu au-delà du monde (son fond déborde). */
export const MAX_WIDTH = WORLD.width * 1.25;

/** Le viewBox d'un cadrage { cx, cy, width } : le sujet au centre en largeur, à FOCUS de la hauteur. */
export function viewBoxOf({ cx, cy, width }) {
  const w = Math.min(width, MAX_WIDTH);
  const h = w * ASPECT;
  return { x: cx - w / 2, y: cy - FOCUS * h, width: w, height: h };
}

/** Un cadrage entre deux autres : la position en ligne droite, le zoom en proportion (régulier à l'œil). */
function between(a, b, f) {
  return {
    cx: lerp(a.cx, b.cx, f),
    cy: lerp(a.cy, b.cy, f),
    width: Math.exp(lerp(Math.log(a.width), Math.log(b.width), f)),
  };
}

export class Shots {
  /**
   * @param {readonly { at: number, blend: number, frame: (t: number) => { cx: number, cy: number, width: number } }[]} shots
   *   chaque plan commence à `at` (secondes) et se fond depuis le précédent pendant `blend` secondes
   */
  constructor(shots) {
    if (!shots.length) throw new TypeError('Une caméra a au moins un plan');
    this.shots = [...shots].sort((a, b) => a.at - b.at);
  }

  /** Le cadrage au temps `t`. */
  framing(t) {
    let index = 0;
    while (index + 1 < this.shots.length && this.shots[index + 1].at <= t) index++;
    const shot = this.shots[index];
    const framing = shot.frame(t);
    const previous = this.shots[index - 1];
    if (!previous || shot.blend <= 0) return framing;
    const f = EASE.inOut(phase(t, shot.at, shot.at + shot.blend));
    return f >= 1 ? framing : between(previous.frame(t), framing, f);
  }

  /** Le viewBox au temps `t`. */
  at(t) {
    return viewBoxOf(this.framing(t));
  }
}
