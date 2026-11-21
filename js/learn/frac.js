/**
 * La fracture de Clivage dans les épisodes (1.19.0) : des fonctions pures du temps, sans horloge.
 *
 * La règle de la série : brisé veut dire en route, entier veut dire arrivé. Le titre se brise et se répare
 * à la première seconde ; chaque sous-titre arrive brisé et se répare ; le numéro d'un panneau se fêle
 * quand le panneau se pose ; un mot ne se brise tout entier que là où l'histoire dit « en morceaux ».
 * Jamais deux fractures à la fois, jamais un sous-titre qui se brise pendant qu'on le lit.
 *
 * Toujours par paliers, comme sur le site : chaque état recalcule la forme des lettres variables, alors
 * qu'un état qui ne change pas d'une image à l'autre ne coûte rien. Les valeurs tombent sur une grille de
 * 5 (FRAC 0, 5, … 100) : la feuille de la page a une classe par valeur (`frac-35`), la CSP refusant
 * l'attribut style. Le film se tourne image par image, dans le désordre : l'état ne dépend que de t.
 */

/** Le pas de la grille FRAC (et des classes de la page). */
export const FRAC_STEP = 5;

/** Le temps d'un sous-titre (ou d'un mot) qui se répare, en secondes : la seule source de cette durée. */
export const REPAIR = 0.35;
const REPAIR_STEPS = 10;

/** Le titre de la première seconde : il se brise en 3 paliers, puis se répare en 12 (comme le hero du site). */
export const TITLE = Object.freeze({ duration: 1, breakShare: 0.16, breakSteps: 3, repairSteps: 12 });

/** Le numéro fêlé d'un panneau : 35 au repos, 85 au moment où il se pose, puis 35 de nouveau. */
export const CRACK = Object.freeze({ rest: 35, peak: 85, rise: 0.2, riseSteps: 4, fall: 0.3, fallSteps: 5 });

/** Un mot qui se brise tout entier (« PAGE ? » en bits) : en 8 paliers. */
export const BREAK = Object.freeze({ duration: 0.45, steps: 8 });

/** Ramène une valeur sur la grille FRAC, entre 0 et 100. */
export function snapFrac(value) {
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped / FRAC_STEP) * FRAC_STEP;
}

/** La classe CSS d'une valeur FRAC (`frac-0` … `frac-100`). */
export const fracClass = (value) => `frac-${snapFrac(value)}`;

/**
 * Une valeur qui va de `from` à `to` entre `start` et `start + duration`, en `steps` paliers, comme
 * `steps(n, end)` en CSS : elle saute à la fin de chaque intervalle.
 */
export function stepped(t, { start, duration, from, to, steps }) {
  if (t < start) return from;
  if (t >= start + duration) return to;
  const k = Math.floor(((t - start) / duration) * steps);
  return snapFrac(from + ((to - from) * k) / steps);
}

/** Un texte qui arrive brisé à `start` et se répare : 100, puis 0 une fois entier (`start + REPAIR`). */
export const repair = (t, start) => stepped(t, { start, duration: REPAIR, from: 100, to: 0, steps: REPAIR_STEPS });

/** L'instant où un texte arrivé à `start` est entier : sa fenêtre de lecture commence là. */
export const wholeAt = (start) => start + REPAIR;

/** Le titre de la première seconde, qui commence à `start` : entier, brisé d'un coup, puis réparé. */
export function shatter(t, start) {
  const breakEnd = start + TITLE.duration * TITLE.breakShare;
  if (t < breakEnd) return stepped(t, { start, duration: breakEnd - start, from: 0, to: 100, steps: TITLE.breakSteps });
  return stepped(t, { start: breakEnd, duration: start + TITLE.duration - breakEnd, from: 100, to: 0, steps: TITLE.repairSteps });
}

/** Le numéro d'un panneau qui se pose à `at` : il se fêle (35 → 85) puis revient à 35. */
export function crack(t, at) {
  const top = at + CRACK.rise;
  if (t < top) return stepped(t, { start: at, duration: CRACK.rise, from: CRACK.rest, to: CRACK.peak, steps: CRACK.riseSteps });
  return stepped(t, { start: top, duration: CRACK.fall, from: CRACK.peak, to: CRACK.rest, steps: CRACK.fallSteps });
}

/** Un mot qui se brise à `start` et reste brisé jusqu'à `rebuild`, où il se répare. */
export function breakAndRebuild(t, start, rebuild) {
  if (t < rebuild) return stepped(t, { start, duration: BREAK.duration, from: 0, to: 100, steps: BREAK.steps });
  return repair(t, rebuild);
}

/** Les fenêtres (secondes) où chaque fracture change : elles ne se chevauchent jamais (un test le vérifie). */
export const windows = Object.freeze({
  title: (start) => [start, start + TITLE.duration],
  repair: (start) => [start, start + REPAIR],
  crack: (at) => [at, at + CRACK.rise + CRACK.fall],
  break: (start) => [start, start + BREAK.duration],
});
