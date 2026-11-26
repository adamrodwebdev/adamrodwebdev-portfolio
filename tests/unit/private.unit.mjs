// Tests unitaires de nos propres composants (1.23.1), sans navigateur (node --test) : leurs fichiers compilés
// viennent du dépôt privé (scripts/private-assets.mjs) et ne doivent jamais revenir dans ce dépôt public.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FOLDER, LOCK_FILE, PRIVATE_PATH, REPOSITORY, parseLock } from '../../scripts/private-assets.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const lockText = await readFile(new URL(`../../${LOCK_FILE}`, import.meta.url), 'utf8');
const lock = parseLock(lockText);
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });

describe('nos composants restent à nous', () => {
  it('aucun fichier du verrou n’est suivi par ce dépôt public', () => {
    const tracked = git('ls-files', '--', ...lock.files.map((f) => f.path)).trim();
    assert.equal(tracked, '', `fichiers privés commités :\n${tracked}`);
  });

  it('chaque fichier du verrou est ignoré par git', () => {
    const ignored = git('check-ignore', '--no-index', '--', ...lock.files.map((f) => f.path)).trim().split('\n');
    assert.deepEqual(ignored.sort(), lock.files.map((f) => f.path).sort());
  });

  it('les composants attendus sont tous là : Clivage, la silhouette de grains, ses fichiers, Sfumato', () => {
    const paths = new Set(lock.files.map((f) => f.path));
    for (const path of [
      'fonts/clivage-v2-latin.woff2', 'fonts/clivage-v2-cyrillic.woff2',
      'js/fx/particle-silhouette.js', 'js/fx/chladni.js', 'js/fx/grain-file.js', 'js/fx/shard-file.js',
      'assets/grains/emblem.bin', 'assets/grains/emblem-shards.bin', 'scripts/taglines.json',
      'js/audio/score.js', 'js/audio/arrangement.js', 'js/audio/instruments.js', 'js/audio/sfumato.js',
      // les médias de la page de Lumirift (1.24.1)
      'lumirift/clip.mp4', 'lumirift/clip-poster.jpg', 'lumirift/og-lumirift-1200x630.png', 'lumirift/card-modes-800.avif',
    ]) assert.ok(paths.has(path), path);
  });

  it('chaque script copié est compilé : la mention de droits en tête, ni carte de source ni commentaire de code', async () => {
    for (const { path } of lock.files.filter((f) => f.path.endsWith('.js'))) {
      const text = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
      assert.match(text, /^\/\*! .+ Copyright \(c\) 2026 AdamRodWebTech\. All rights reserved\./, path);
      assert.doesNotMatch(text, /sourceMappingURL/, path);
      assert.ok(!text.includes('/**'), `${path} : un commentaire de documentation est resté`);
    }
  });

  it('le verrou refuse un dépôt, un commit, un chemin ou une taille hors des règles', () => {
    const good = JSON.parse(lockText);
    const variant = (change) => JSON.stringify(change(structuredClone(good)));
    assert.throws(() => parseLock('x'.repeat(17 * 1024)), RangeError);
    assert.throws(() => parseLock(variant((l) => ({ ...l, repository: 'someone/else' }))), TypeError);
    assert.throws(() => parseLock(variant((l) => ({ ...l, folder: 'lumirift' }))), TypeError, 'le dossier d’un autre projet');
    assert.throws(() => parseLock(variant((l) => { delete l.folder; return l; })), TypeError, 'sans dossier');
    assert.throws(() => parseLock(variant((l) => ({ ...l, commit: 'main' }))), TypeError);
    assert.throws(() => parseLock(variant((l) => ({ ...l, files: [] }))), RangeError);
    for (const path of ['../secret.js', 'js/fx/../../x.js', 'index.html', 'js/fx/A.js', 'css/x.css', 'lumirift/index.html', 'lumirift/clip.mov', 'lumirift/privacy/x.png']) {
      assert.throws(() => parseLock(variant((l) => { l.files[0].path = path; return l; })), TypeError, path);
    }
    assert.throws(() => parseLock(variant((l) => { l.files[1].path = l.files[0].path; return l; })), TypeError, 'un doublon');
    for (const size of [0, -1, 1.5, '12', 3 * 1024 * 1024]) {
      assert.throws(() => parseLock(variant((l) => { l.files[0].size = size; return l; })), RangeError, String(size));
    }
    assert.throws(() => parseLock(variant((l) => { l.files[0].sha256 = 'abc'; return l; })), TypeError);
    assert.equal(lock.repository, REPOSITORY);
    assert.equal(lock.folder, FOLDER);
    assert.ok(lock.files.every((f) => PRIVATE_PATH.test(f.path)));
  });
});
