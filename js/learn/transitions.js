/**
 * Le panneau qui marque un changement de battement (1.19.0), comme les marches du site : il monte du bas,
 * se pose (son numéro fêlé se fend un peu plus), puis redescend sur le battement suivant. Des fonctions
 * pures du temps : le film et la page les appellent de la même façon.
 */
import { EASE, phase } from './ease.js';

/** Les temps du panneau autour du début `b` d'un battement (secondes). */
export const PANEL = Object.freeze({
  /** Il monte pendant les `rise` secondes qui précèdent le battement… */
  rise: 0.5,
  /** …reste posé jusqu'à `b + hold`… */
  hold: 0.35,
  /** …puis redescend en `leave` secondes. */
  leave: 0.45,
  /** Son numéro se fêle à partir de `b - crackLead`. */
  crackLead: 0.15,
});

/** La fenêtre (secondes) où le panneau du battement qui commence à `b` est à l'écran. */
export const panelWindow = (b) => [b - PANEL.rise, b + PANEL.hold + PANEL.leave];

/**
 * Le décalage du panneau vers le bas, en fraction de l'image : 1 sous l'image, 0 posé ; null hors de sa
 * fenêtre (rien à peindre).
 */
export function panelOffset(t, b) {
  const [from, to] = panelWindow(b);
  if (t < from || t >= to) return null;
  if (t < b) return 1 - EASE.out(phase(t, from, b));
  return EASE.in(phase(t, b + PANEL.hold, to));
}
