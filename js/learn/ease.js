/**
 * Courbes et interpolations des épisodes « Comment marche le Web » (1.14.0) : des fonctions pures,
 * sans horloge ni hasard. Tout ce qui bouge dans un épisode se calcule à partir de son temps t.
 */

/** Ramène `value` entre `min` et `max`. */
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** Interpolation linéaire de `a` à `b` pour `f` entre 0 et 1. */
export const lerp = (a, b, f) => a + (b - a) * f;

/** L'avancée (0 à 1) de `t` entre `start` et `end` ; 0 avant, 1 après. */
export function phase(t, start, end) {
  if (end <= start) return t >= end ? 1 : 0;
  return clamp((t - start) / (end - start));
}

/** Les courbes d'accélération, de 0 à 1. */
export const EASE = Object.freeze({
  linear: (f) => f,
  inOut: (f) => 0.5 - Math.cos(Math.PI * f) / 2,
  out: (f) => 1 - (1 - f) ** 3,
  in: (f) => f ** 3,
  /** Un petit dépassement à l'arrivée : une boîte qui s'enclenche. */
  snap: (f) => {
    const s = 1.70158;
    const g = f - 1;
    return f <= 0 ? 0 : f >= 1 ? 1 : 1 + (s + 1) * g ** 3 + s * g ** 2;
  },
});

/** Un battement bref (0 → 1 → 0) centré sur `at`, large de `width` secondes. */
export function pulse(t, at, width) {
  const f = 1 - Math.abs(t - at) / (width / 2);
  return f > 0 ? EASE.inOut(f) : 0;
}
