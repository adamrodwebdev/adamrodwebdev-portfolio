/**
 * Le fichier des éclats du logo (1.22.0) : la scène de marque d'AdamRodWebTech brise l'emblème en éclats
 * (une fracture 3D faite dans Blender) ; ce fichier dit, grain par grain, sur quel éclat tombe chaque grain du
 * logo de la bande-son, la trajectoire et la rotation de chaque éclat, et la proximité de chaque grain
 * avec une fissure (pour l'allumer avant la cassure). Précalculé hors du site, à partir de
 * assets/grains/emblem.bin, dans le même ordre : les deux fichiers vont ensemble.
 *
 * Format SHD1, petit-boutiste :
 *   octets 0-3   « SHD1 »
 *   4-7          nombre de grains (entier), égal à celui du fichier des grains
 *   8-9          nombre d'éclats (entier, 1 à 255)        10-11  0
 *   puis         par éclat : trajectoire x, y et rotation (trois entiers signés de 16 bits, de -1 à 1)
 *   puis         par grain : son éclat (un octet)
 *   puis         par grain : sa proximité d'une fissure (un octet, 255 sur la fissure)
 *
 * Fonction pure, sans DOM. Le fichier est refusé avant toute lecture s'il n'a pas la bonne taille.
 */
const MAGIC = 'SHD1';
const HEADER = 12;
const MAX_GRAINS = 60000;
const MAX_SHARDS = 255;
/** Au-delà, le fichier est refusé avant toute lecture. */
export const MAX_SHARD_BYTES = HEADER + MAX_SHARDS * 6 + MAX_GRAINS * 2;

/**
 * Lit un fichier d'éclats, ou le refuse : taille, en-tête, accord avec le nombre de grains, indices d'éclat.
 * @param {ArrayBuffer} buffer
 * @param {number} grainCount le nombre de grains du fichier des grains, que celui-ci doit égaler
 * @returns {{ count: number, shards: number, fly: Float32Array, spin: Float32Array, shardOf: Uint8Array, crack: Float32Array }}
 */
export function decodeShards(buffer, grainCount) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < HEADER || buffer.byteLength > MAX_SHARD_BYTES) {
    throw new RangeError('fichier d’éclats de taille invalide');
  }
  if (!Number.isInteger(grainCount) || grainCount < 1 || grainCount > MAX_GRAINS) throw new RangeError('nombre de grains invalide');
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== MAGIC) throw new TypeError('ce fichier n’est pas un fichier d’éclats');
  const count = view.getUint32(4, true);
  const shards = view.getUint16(8, true);
  if (count !== grainCount || shards < 1 || shards > MAX_SHARDS || buffer.byteLength !== HEADER + shards * 6 + count * 2) {
    throw new RangeError('le fichier d’éclats ne correspond pas aux grains');
  }
  const fly = new Float32Array(shards * 2);
  const spin = new Float32Array(shards);
  let o = HEADER;
  for (let s = 0; s < shards; s++, o += 6) {
    fly[s * 2] = view.getInt16(o, true) / 32767;
    fly[s * 2 + 1] = view.getInt16(o + 2, true) / 32767;
    spin[s] = view.getInt16(o + 4, true) / 32767;
  }
  const shardOf = new Uint8Array(buffer, o, count).slice();
  o += count;
  const crack = new Float32Array(count);
  for (let k = 0; k < count; k++, o++) {
    if (shardOf[k] >= shards) throw new RangeError('indice d’éclat hors limites');
    crack[k] = view.getUint8(o) / 255;
  }
  return { count, shards, fly, spin, shardOf, crack };
}
