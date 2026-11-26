// Tests unitaires des fichiers de grains que le site charge (1.21.0, 1.22.0, 1.23.0), sans navigateur (node --test).
// Le format, ses refus et les figures de Chladni se testent dans le dépôt privé particle-silhouette (1.23.1) ;
// ici, les fichiers copiés depuis le dépôt privé (scripts/private-assets.mjs) vont avec ce que le site attend.
// Le rendu lui-même (WebGL2, chargement à l'approche) est vérifié par les tests Playwright de tests/site.spec.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { decodeGrains } from '../../js/fx/grain-file.js';
import { decodeShards } from '../../js/fx/shard-file.js';
import { EMBLEM_GRAINS, EMBLEM_SHARDS } from '../../js/fx/soundtrack-grains.js';
import { TAGLINE_GRAINS, TAGLINE_LANGS, taglineFile } from '../../js/fx/clients-dust.js';

const bufferOf = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const read = async (path) => bufferOf(await readFile(new URL(`../../${path}`, import.meta.url)));
/** Le texte que dessine chaque fichier de la devise, tel que le dépôt privé l'a précalculé. */
const TAGLINES = JSON.parse(await readFile(new URL('../../scripts/taglines.json', import.meta.url), 'utf8'));

describe('les grains du site', () => {
  it('le logo de la bande-son est lisible, avec le nombre de grains attendu', async () => {
    const grains = decodeGrains(await read(EMBLEM_GRAINS.file));
    assert.equal(grains.count, EMBLEM_GRAINS.count);
    assert.ok(grains.aspect > 0.8 && grains.aspect < 0.95, 'un hexagone pointe en haut, un peu plus haut que large');
    assert.ok(grains.positions.every((v) => v >= -1 && v <= 1));
  });

  it('les éclats du logo vont grain pour grain avec le fichier des grains', async () => {
    const grains = decodeGrains(await read(EMBLEM_GRAINS.file));
    const cuts = decodeShards(await read(EMBLEM_SHARDS.file), grains.count);
    assert.ok(cuts.shards >= 40 && cuts.shards <= 120, `la fracture de la scène de marque (${cuts.shards} éclats)`);
    const onCrack = cuts.crack.filter((c) => c > 0.5).length / cuts.count;
    assert.ok(onCrack > 0.05 && onCrack < 0.5, `des fissures fines (${(onCrack * 100).toFixed(0)} % des grains)`);
  });

  it('la devise des offres existe dans chaque langue, en deux lignes, plus large que haute', async () => {
    for (const lang of TAGLINE_LANGS) {
      const grains = decodeGrains(await read(taglineFile(lang)));
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
