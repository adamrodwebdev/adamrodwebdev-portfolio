// Tests unitaires du sable et des éclats du logo de la bande-son (1.22.0), sans navigateur (node --test).
// Le rendu lui-même (WebGL2, figures, cassure) est vérifié dans le navigateur par tests/site.spec.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { MODES, nodalTargets, plateValue } from '../../js/fx/chladni.js';
import { decodeGrains } from '../../js/fx/grain-file.js';
import { MAX_SHARD_BYTES, decodeShards } from '../../js/fx/shard-file.js';
import { EMBLEM_GRAINS, EMBLEM_SHARDS } from '../../js/fx/soundtrack-grains.js';

const bufferOf = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

/** Un petit fichier d'éclats écrit à la main : 3 grains sur 2 éclats. */
function tiny({ count = 3, shards = 2, shardOf = [0, 1, 1] } = {}) {
  const bytes = new Uint8Array(12 + shards * 6 + count * 2);
  const view = new DataView(bytes.buffer);
  'SHD1'.split('').forEach((c, i) => view.setUint8(i, c.charCodeAt(0)));
  view.setUint32(4, count, true);
  view.setUint16(8, shards, true);
  for (let s = 0; s < shards; s++) {
    view.setInt16(12 + s * 6, 32767, true);
    view.setInt16(14 + s * 6, -32767, true);
    view.setInt16(16 + s * 6, 0, true);
  }
  const o = 12 + shards * 6;
  shardOf.forEach((s, k) => view.setUint8(o + k, s));
  for (let k = 0; k < count; k++) view.setUint8(o + count + k, k === 0 ? 255 : 0);
  return bytes;
}

describe('le fichier des éclats', () => {
  it('rend les trajectoires, les éclats et la proximité des fissures', () => {
    const cuts = decodeShards(bufferOf(tiny()), 3);
    assert.equal(cuts.shards, 2);
    assert.deepEqual(Array.from(cuts.shardOf), [0, 1, 1]);
    assert.equal(cuts.fly[0], 1);
    assert.equal(cuts.fly[1], -1);
    assert.equal(cuts.crack[0], 1);
    assert.equal(cuts.crack[2], 0);
  });

  it('refuse ce qui n’est pas un fichier d’éclats, ou qui ne va pas avec les grains', () => {
    assert.throws(() => decodeShards('SHD1', 3), RangeError);
    assert.throws(() => decodeShards(new ArrayBuffer(MAX_SHARD_BYTES + 1), 3), RangeError, 'trop grand');
    const wrongMagic = tiny();
    wrongMagic[0] = 0x58;
    assert.throws(() => decodeShards(bufferOf(wrongMagic), 3), TypeError);
    assert.throws(() => decodeShards(bufferOf(tiny()), 4), RangeError, 'un autre nombre de grains');
    assert.throws(() => decodeShards(bufferOf(tiny().slice(0, -1)), 3), RangeError, 'un fichier tronqué');
    assert.throws(() => decodeShards(bufferOf(tiny({ shardOf: [0, 1, 2] })), 3), RangeError, 'un éclat qui n’existe pas');
    assert.throws(() => decodeShards(bufferOf(tiny()), 0), RangeError);
  });

  it('les éclats du logo sont versionnés et vont grain pour grain avec le fichier des grains', async () => {
    const grains = decodeGrains(bufferOf(await readFile(new URL(`../../${EMBLEM_GRAINS.file}`, import.meta.url))));
    const cuts = decodeShards(bufferOf(await readFile(new URL(`../../${EMBLEM_SHARDS.file}`, import.meta.url))), grains.count);
    assert.ok(cuts.shards >= 40 && cuts.shards <= 120, `la fracture de la scène de marque (${cuts.shards} éclats)`);
    assert.ok(cuts.fly.every((v) => v >= -1 && v <= 1));
    const onCrack = cuts.crack.filter((c) => c > 0.5).length / cuts.count;
    assert.ok(onCrack > 0.05 && onCrack < 0.5, `des fissures fines (${(onCrack * 100).toFixed(0)} % des grains)`);
  });
});

describe('les figures de Chladni', () => {
  const grid = (n) => Float32Array.from({ length: n * 2 }, (_, i) => Math.sin(i * 7.31) * 0.42);

  it('range chaque grain sur une ligne nodale ou, s’il en sortirait, sur le bord de l’hexagone', () => {
    const positions = grid(2000);
    const apothem = 0.5 * Math.cos(Math.PI / 6);
    for (const mode of MODES) {
      const targets = nodalTargets(positions, 2000, mode);
      let placed = 0;
      for (let k = 0; k < 2000; k++) {
        const x = targets[k * 2], y = targets[k * 2 + 1];
        const reach = Math.max(Math.abs(x), 0.5 * Math.abs(x) + Math.cos(Math.PI / 6) * Math.abs(y));
        assert.ok(reach <= apothem + 1e-6, 'dans l’hexagone');
        if (Math.abs(plateValue(x, y, mode)) < 0.02 || reach > apothem * 0.97 - 1e-4) placed++;
      }
      assert.ok(placed / 2000 > 0.97, `mode ${mode} : ${(placed / 20).toFixed(0)} % des grains rangés`);
    }
  });

  it('va du mode le plus simple au plus riche, et refuse un mode impossible', () => {
    assert.ok(MODES.every(([n, m]) => Number.isInteger(n) && Number.isInteger(m) && n !== m));
    assert.throws(() => nodalTargets(grid(10), 10, [2, 2]), RangeError);
    assert.throws(() => nodalTargets(grid(10), 10, [0, 3]), RangeError);
    assert.throws(() => nodalTargets(grid(10), 11, [1, 2]), RangeError, 'plus de grains que de positions');
    assert.throws(() => nodalTargets([0, 0], 1, [1, 2]), RangeError, 'pas un Float32Array');
  });
});
