// Tests unitaires du fichier des grains précalculés (1.21.0, 1.23.0), sans navigateur (node --test).
// Le rendu lui-même (WebGL2, chargement à l'approche) est vérifié par les tests Playwright de tests/site.spec.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { MAX_GRAINS, decodeGrains, encodeGrains } from '../../js/fx/grain-file.js';
import { EMBLEM_GRAINS } from '../../js/fx/soundtrack-grains.js';
import { TAGLINE_GRAINS, TAGLINE_LANGS, taglineFile } from '../../js/fx/clients-dust.js';
import { TAGLINES } from '../../scripts/taglines.mjs';

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

  it('garde les côtés d’une forme large (GRN2) : les positions au-delà de -1..1 reviennent entières', () => {
    const wide = { ...sample(300), aspect: 3.1 };
    wide.positions = wide.positions.map((v, i) => (i % 2 === 0 ? v * 2.6 : v * 0.5));
    const bytes = encodeGrains(wide);
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'GRN2');
    const back = decodeGrains(bufferOf(bytes));
    const scale = Math.max(...wide.positions.map(Math.abs));
    assert.ok(Math.max(...back.positions.map(Math.abs)) > 1.5, 'les côtés ne sont pas coupés à 1');
    for (let i = 0; i < wide.positions.length; i++) assert.ok(Math.abs(back.positions[i] - wide.positions[i]) <= (2 * scale) / 65535 + 1e-6);
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
    assert.throws(() => decodeGrains(new ArrayBuffer(20 + (MAX_GRAINS + 1) * 5)), RangeError, 'trop grand');
    const badScale = good.slice();
    new DataView(badScale.buffer).setFloat32(16, Number.NaN, true);
    assert.throws(() => decodeGrains(bufferOf(badScale)), RangeError, 'une échelle qui n’est pas un nombre');
    assert.throws(() => encodeGrains(sample(0)), RangeError);
  });

  it('le logo de la bande-son est versionné, lisible, avec le nombre de grains attendu', async () => {
    const bytes = await readFile(new URL(`../../${EMBLEM_GRAINS.file}`, import.meta.url));
    const grains = decodeGrains(bufferOf(bytes));
    assert.equal(grains.count, EMBLEM_GRAINS.count);
    assert.ok(grains.aspect > 0.8 && grains.aspect < 0.95, 'un hexagone pointe en haut, un peu plus haut que large');
    assert.ok(grains.positions.every((v) => v >= -1 && v <= 1));
  });

  it('la devise des offres existe dans chaque langue, en deux lignes, plus large que haute', async () => {
    for (const lang of TAGLINE_LANGS) {
      const bytes = await readFile(new URL(`../../${taglineFile(lang)}`, import.meta.url));
      const grains = decodeGrains(bufferOf(bytes));
      assert.equal(grains.count, TAGLINE_GRAINS.count, lang);
      assert.ok(grains.aspect > 2 && grains.aspect < 3.5, `${lang} : rapport ${grains.aspect}`);
      assert.equal(TAGLINES[lang].split('\n').length, 2, lang);
    }
    assert.deepEqual(Object.keys(TAGLINES).sort(), [...TAGLINE_LANGS].sort());
  });

  it('les grains disent la même devise que le texte lu par les lecteurs d’écran', async () => {
    for (const lang of TAGLINE_LANGS) {
      const { default: texts } = await import(`../../js/i18n/locales/${lang}.js`);
      assert.equal(TAGLINES[lang].replace('\n', ' '), texts.offers.motto.toLocaleUpperCase(lang), lang);
    }
  });
});
