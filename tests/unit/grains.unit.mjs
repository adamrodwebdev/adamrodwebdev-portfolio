// Tests unitaires du fichier des grains précalculés (1.21.0), sans navigateur (node --test).
// Le rendu lui-même (WebGL2, chargement à l'approche) est vérifié par les tests Playwright de tests/site.spec.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { MAX_GRAINS, decodeGrains, encodeGrains } from '../../js/fx/grain-file.js';
import { EMBLEM_GRAINS } from '../../js/fx/soundtrack-grains.js';

const sample = (count) => ({
  count,
  aspect: 0.857,
  area: 0.62,
  positions: Float32Array.from({ length: count * 2 }, (_, i) => Math.sin(i * 12.9898) * 0.6),
  edges: Float32Array.from({ length: count }, (_, i) => (i % 7) / 6),
});
const bufferOf = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

describe('le fichier des grains', () => {
  it('rend les grains écrits, à la précision près (positions sur 16 bits, bords sur 8)', () => {
    const grains = sample(500);
    const back = decodeGrains(bufferOf(encodeGrains(grains)), 'logo');
    assert.equal(back.count, 500);
    assert.equal(back.label, 'logo');
    assert.ok(Math.abs(back.aspect - grains.aspect) < 1e-6);
    for (let i = 0; i < grains.positions.length; i++) assert.ok(Math.abs(back.positions[i] - grains.positions[i]) <= 2 / 65535);
    for (let i = 0; i < grains.count; i++) assert.ok(Math.abs(back.edges[i] - grains.edges[i]) <= 1 / 255);
  });

  it('refuse ce qui n’est pas un fichier de grains, avant toute lecture', () => {
    const good = encodeGrains(sample(10));
    assert.throws(() => decodeGrains('GRN1'), RangeError);
    assert.throws(() => decodeGrains(new ArrayBuffer(8)), RangeError);
    const wrongMagic = good.slice();
    wrongMagic[0] = 0x58;
    assert.throws(() => decodeGrains(bufferOf(wrongMagic)), TypeError);
    assert.throws(() => decodeGrains(bufferOf(good.slice(0, good.length - 1))), RangeError, 'un fichier tronqué');
    const lying = good.slice();
    new DataView(lying.buffer).setUint32(4, 11, true);
    assert.throws(() => decodeGrains(bufferOf(lying)), RangeError, 'un nombre qui ment sur la taille');
    assert.throws(() => decodeGrains(new ArrayBuffer(16 + (MAX_GRAINS + 1) * 5)), RangeError, 'trop grand');
    assert.throws(() => encodeGrains(sample(0)), RangeError);
  });

  it('le logo de la bande-son est versionné, lisible, avec le nombre de grains attendu', async () => {
    const bytes = await readFile(new URL(`../../${EMBLEM_GRAINS.file}`, import.meta.url));
    const grains = decodeGrains(bufferOf(bytes));
    assert.equal(grains.count, EMBLEM_GRAINS.count);
    assert.ok(grains.aspect > 0.8 && grains.aspect < 0.95, 'un hexagone pointe en haut, un peu plus haut que large');
    assert.ok(grains.positions.every((v) => v >= -1 && v <= 1));
  });
});
