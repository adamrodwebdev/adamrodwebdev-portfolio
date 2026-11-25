/**
 * Les figures de Chladni du logo de la bande-son (1.22.0) : du sable sur une plaque qui vibre se range sur les
 * lignes nodales, là où la plaque ne bouge pas. Chaque mode (n, m) d'une plaque carrée a pour lignes
 *   f(x, y) = cos(n·π·x) · cos(m·π·y) − cos(m·π·x) · cos(n·π·y) = 0,   x, y dans [0, 1]
 * (les figures classiques de Chladni ; plus le mode est haut, plus il y a de lignes, comme une note plus aiguë).
 * Pour chaque grain, on calcule une fois le point le plus proche de ces lignes, en quelques pas de Newton le
 * long du gradient. La plaque couvre la boîte du logo (le logo mesure 1 de haut, centré) ; ce qui sortirait de
 * l'hexagone est ramené sur son bord. Mathématiques seules, sans DOM.
 */

/** Du moins de lignes au plus : la clarté de la musique choisit le long de cette liste. */
export const MODES = Object.freeze([
  [1, 2], [1, 3], [2, 3], [1, 4], [2, 5], [3, 4], [3, 5], [4, 5],
]);

const SPAN = 1.0;          // côté de la plaque, en unités du logo
const STEPS = 7;           // pas de Newton vers la ligne nodale
const MAX_STEP = 0.06;     // pas maximal, en unités de plaque : un grain ne traverse jamais la plaque
const COS30 = Math.cos(Math.PI / 6);
/** L'hexagone du logo (pointe en haut, 1 de haut) : son rayon intérieur, un peu en deçà du bord des grains. */
const HEX_APOTHEM = 0.5 * COS30 * 0.97;

/**
 * La cible nodale de chaque grain pour un mode, en unités du logo.
 * @param {Float32Array} positions x, y de chaque grain (unités du logo)
 * @param {number} count
 * @param {[number, number]} mode
 * @returns {Float32Array} x, y de chaque grain
 */
export function nodalTargets(positions, count, [n, m]) {
  if (!Number.isInteger(n) || !Number.isInteger(m) || n < 1 || m < 1 || n === m || n > 12 || m > 12) {
    throw new RangeError(`mode de Chladni invalide : ${n}, ${m}`);
  }
  if (!Number.isInteger(count) || count < 0 || !(positions instanceof Float32Array) || positions.length < count * 2) {
    throw new RangeError('grains invalides');
  }
  const out = new Float32Array(count * 2);
  const pn = Math.PI * n, pm = Math.PI * m;
  for (let k = 0; k < count; k++) {
    let x = 0.5 + positions[k * 2] / SPAN;
    let y = 0.5 + positions[k * 2 + 1] / SPAN;
    for (let i = 0; i < STEPS; i++) {
      const cnx = Math.cos(pn * x), snx = Math.sin(pn * x), cmx = Math.cos(pm * x), smx = Math.sin(pm * x);
      const cny = Math.cos(pn * y), sny = Math.sin(pn * y), cmy = Math.cos(pm * y), smy = Math.sin(pm * y);
      const f = cnx * cmy - cmx * cny;
      const gx = -pn * snx * cmy + pm * smx * cny;
      const gy = -pm * cnx * smy + pn * cmx * sny;
      const g2 = gx * gx + gy * gy + 1e-6;
      let dx = -f * gx / g2, dy = -f * gy / g2;
      const len = Math.hypot(dx, dy);
      if (len > MAX_STEP) { dx *= MAX_STEP / len; dy *= MAX_STEP / len; }
      x += dx; y += dy;
      if (Math.abs(f) < 1e-3) break;
    }
    // la plaque est l'hexagone du logo : le sable qui en sortirait reste sur son bord
    let tx = (x - 0.5) * SPAN, ty = (y - 0.5) * SPAN;
    const reach = Math.max(Math.abs(tx), 0.5 * Math.abs(tx) + COS30 * Math.abs(ty));
    if (reach > HEX_APOTHEM) { const s = HEX_APOTHEM / reach; tx *= s; ty *= s; }
    out[k * 2] = tx;
    out[k * 2 + 1] = ty;
  }
  return out;
}

/** La valeur de la fonction du mode en un point du logo (pour les tests : nulle sur une ligne nodale). */
export function plateValue(x, y, [n, m]) {
  const px = 0.5 + x / SPAN, py = 0.5 + y / SPAN;
  return Math.cos(Math.PI * n * px) * Math.cos(Math.PI * m * py) - Math.cos(Math.PI * m * px) * Math.cos(Math.PI * n * py);
}
