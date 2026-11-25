/**
 * Le fichier des grains précalculés (1.21.0) : la silhouette du logo, échantillonnée une fois par
 * scripts/bake-grains.mjs, pour que le navigateur du visiteur n'ait rien à calculer (l'échantillonnage
 * coûte de 150 à 590 ms au ralenti 4 ×).
 *
 * Format, petit-boutiste :
 *   octets 0-3   « GRN1 »
 *   4-7          nombre de grains (entier)
 *   8-11         rapport largeur / hauteur de la forme (flottant)
 *   12-15        aire intérieure rapportée à la hauteur² (flottant)
 *   puis         x, y de chaque grain : deux entiers de 16 bits, de -1 à 1
 *   puis         bord de chaque grain : un octet, de 0 (cœur) à 1 (bord)
 * L'ordre des grains est aléatoire : tout préfixe est un sous-échantillon régulier.
 *
 * Les deux fonctions sont pures, sans DOM : la génération (Node) et la page (navigateur) les partagent.
 */
const MAGIC = 'GRN1';
const HEADER = 16;
const BYTES_PER_GRAIN = 5;
/** Au-delà, le fichier est refusé avant toute lecture. */
export const MAX_GRAINS = 60000;
export const MAX_GRAIN_BYTES = HEADER + MAX_GRAINS * BYTES_PER_GRAIN;

const toUnit = (q) => (q / 65535) * 2 - 1;
const fromUnit = (v) => Math.round((Math.min(1, Math.max(-1, v)) + 1) / 2 * 65535);

/** Les grains d'une forme ({ positions, edges, count, aspect, area }) en octets. */
export function encodeGrains({ positions, edges, count, aspect, area }) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_GRAINS) throw new RangeError(`nombre de grains hors limites : ${count}`);
  if (positions.length < count * 2 || edges.length < count) throw new RangeError('grains incomplets');
  const buffer = new ArrayBuffer(HEADER + count * BYTES_PER_GRAIN);
  const view = new DataView(buffer);
  for (let i = 0; i < 4; i++) view.setUint8(i, MAGIC.charCodeAt(i));
  view.setUint32(4, count, true);
  view.setFloat32(8, aspect, true);
  view.setFloat32(12, area, true);
  let o = HEADER;
  for (let k = 0; k < count * 2; k++, o += 2) view.setUint16(o, fromUnit(positions[k]), true);
  for (let k = 0; k < count; k++, o += 1) view.setUint8(o, Math.round(Math.min(1, Math.max(0, edges[k])) * 255));
  return new Uint8Array(buffer);
}

/**
 * Lit un fichier de grains, ou le refuse : taille vérifiée avant la lecture, en-tête, nombre, valeurs finies.
 * @param {ArrayBuffer} buffer
 * @param {string} label le nom de la forme (pour les lecteurs d'écran, s'il est montré)
 */
export function decodeGrains(buffer, label = 'silhouette') {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < HEADER || buffer.byteLength > MAX_GRAIN_BYTES) {
    throw new RangeError('fichier de grains de taille invalide');
  }
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== MAGIC) throw new TypeError('ce fichier n’est pas un fichier de grains');
  const count = view.getUint32(4, true);
  if (count < 1 || count > MAX_GRAINS || buffer.byteLength !== HEADER + count * BYTES_PER_GRAIN) {
    throw new RangeError('nombre de grains incohérent avec la taille du fichier');
  }
  const aspect = view.getFloat32(8, true);
  const area = view.getFloat32(12, true);
  if (!(aspect > 0.05 && aspect < 20) || !(area > 0 && area < 20)) throw new RangeError('mesures de forme invalides');
  const positions = new Float32Array(count * 2);
  const edges = new Float32Array(count);
  let o = HEADER;
  for (let k = 0; k < count * 2; k++, o += 2) positions[k] = toUnit(view.getUint16(o, true));
  for (let k = 0; k < count; k++, o += 1) edges[k] = view.getUint8(o) / 255;
  return { positions, edges, count, aspect, area, label };
}
