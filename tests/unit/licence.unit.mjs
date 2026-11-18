/**
 * Tests unitaires de la licence des polices Ressac (1.18.0), lancés par `npm run test:unit` (node:test) :
 *  - les copies sont celles de la fonderie, au commit noté, et une copie retouchée arrête la génération ;
 *  - le texte arrive dans la page mot pour mot, rien de perdu, rien d'ajouté, dans l'ordre ;
 *  - le sommaire couvre chaque article, chaque ancre est unique ;
 *  - le lecteur de Markdown refuse ce qu'il ne sait pas rendre (table d'entrées hostiles) et échappe le reste.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LICENCE_PAGES, LICENCE_SOURCE, gitBlobId, readLicence } from '../../scripts/licence-pages.mjs';
import { renderLicence, inline, slug } from '../../scripts/licence-markdown.mjs';
import { licencePage } from '../../js/i18n/messages.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const source = (page) => readFile(join(ROOT, page.copy), 'utf8');

/** Le texte d'un HTML : balises de mise en forme ôtées, blocs séparés d'une espace, entités rendues. */
const plain = (html) => html
  .replace(/<\/?(?:strong|code|a)\b[^>]*>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

/** Le texte d'un fichier Markdown, sans sa syntaxe : titres, puces, numéros, gras, code, barres de tableau. */
const markdownText = (markdown) => markdown.split('\n')
  .filter((line) => line.trim() && !/^\|[\s:|-]+\|$/.test(line))
  .map((line) => (line.startsWith('|') ? line.slice(1, -1).split('|').join(' ') : line)
    .trim().replace(/^(?:#+ |- |\d+\. )/, '').replace(/\*\*|`/g, ''))
  .join(' ').replace(/\s+/g, ' ').trim();

const rendered = (doc) => plain([doc.title, doc.version, doc.intro, ...doc.sections.flatMap((s) => [s.title, s.html])].join('\n'));

test('les copies sont celles de la fonderie, au commit noté', async () => {
  assert.match(LICENCE_SOURCE.commit, /^[0-9a-f]{40}$/);
  for (const page of LICENCE_PAGES) assert.equal(gitBlobId(await source(page)), page.blob, page.copy);
  // Les fins de ligne Windows ne changent pas l'identifiant (le dépôt garde des LF)
  const text = await source(LICENCE_PAGES[0]);
  assert.equal(gitBlobId(text.replace(/\n/g, '\r\n')), LICENCE_PAGES[0].blob);
});

test('une copie retouchée arrête la génération', async () => {
  const page = { ...LICENCE_PAGES[0], blob: '0'.repeat(40) };
  await assert.rejects(() => readLicence(ROOT, page), /n'est plus la copie de licence\/EULA\.fr\.md/);
});

test('le texte arrive dans la page mot pour mot, dans l’ordre, sans rien de plus', async () => {
  for (const page of LICENCE_PAGES) {
    const markdown = await source(page);
    assert.equal(rendered(renderLicence(markdown, { anchor: page.anchor })), markdownText(markdown), page.code);
  }
});

test('le sommaire couvre chaque article, et chaque ancre est unique', async () => {
  const expected = {
    fr: ['annexe-a', 'historique-des-versions'],
    en: ['schedule-a', 'version-history'],
  };
  for (const page of LICENCE_PAGES) {
    const doc = renderLicence(await source(page), { anchor: page.anchor });
    const numbered = Array.from({ length: 18 }, (_, i) => `${page.anchor}-${i + 1}`);
    assert.deepEqual(doc.sections.map((section) => section.id), [...numbered, ...expected[page.code]], page.code);
    // Les interdits de l'article 10 ont chacun leur ancre (10.1 à 10.5), que le texte cite
    const ten = doc.sections.find((section) => section.id === `${page.anchor}-10`).html;
    for (let n = 1; n <= 5; n += 1) assert.ok(ten.includes(`id="${page.anchor}-10-${n}"`), `${page.code} 10.${n}`);
    // Les tableaux défilent dans un cadre nommé par leur titre, atteignable au clavier
    const annex = doc.sections.find((section) => section.id === expected[page.code][0]).html;
    assert.match(annex, new RegExp(`class="licence__table licence__table--wide" role="region" aria-labelledby="${expected[page.code][0]}" tabindex="0"`));
  }
});

test('les textes de la page existent dans les deux langues, avec les mêmes clés', () => {
  const keys = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) =>
    (typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]));
  assert.deepEqual(keys(licencePage.en), keys(licencePage.fr));
  for (const value of keys(licencePage.fr)) assert.ok(value);
  assert.match(licencePage.en.notice, /French version prevails/);
});

test('le texte est échappé, le gras, le code et les adresses balisés', () => {
  assert.equal(inline('a < b & "c"'), 'a &lt; b &amp; &quot;c&quot;');
  assert.equal(inline('**gras** et `code <x>`'), '<strong>gras</strong> et <code>code &lt;x&gt;</code>');
  assert.equal(inline('Écrire à contact@exemple.fr.'), 'Écrire à <a href="mailto:contact@exemple.fr">contact@exemple.fr</a>.');
  assert.equal(inline('Voir https://www.cm2c.net (en ligne)'), 'Voir <a href="https://www.cm2c.net">https://www.cm2c.net</a> (en ligne)');
  // Une adresse http ou javascript: reste du texte
  assert.equal(inline('http://exemple.com et javascript:alert(1)'), 'http://exemple.com et javascript:alert(1)');
  assert.equal(slug('Annexe A '), 'annexe-a');
  assert.equal(slug('Historique des versions'), 'historique-des-versions');
});

test('le lecteur refuse le balisage qu’il ne sait pas rendre', () => {
  const licence = (body) => `# Titre\n\nVersion 1.0\n\n## 1. Article\n\n${body}\n`;
  const hostile = [
    '### Sous-titre',
    '> Une citation',
    'Un [lien](https://exemple.com) caché',
    '<script>alert(1)</script>',
    '  <img src=x onerror=alert(1)>',
    'Un *italique* seul',
    '* une puce étoile',
    '+ une puce plus',
    '```\ncode\n```',
    '| a | b |\n| c | d |',
    '| a | b |\n|---|---|\n| c |',
    '1. un\n3. trois',
    '- un\n texte sans retrait',
    'Un `code sans fin',
  ];
  for (const body of hostile) assert.throws(() => renderLicence(licence(body), { anchor: 'article' }), Error, body);
  assert.throws(() => renderLicence('Version 1.0\n', { anchor: 'article' }), /commencer par son titre/);
  assert.throws(() => renderLicence('# Titre\n\nUn texte\n\n## 1. A\n', { anchor: 'article' }), /ligne de version/);
  assert.throws(() => renderLicence('# Titre\n\nVersion 1.0\n', { anchor: 'article' }), /aucun article/);
  assert.throws(() => renderLicence('# Titre\n\nVersion 1.0\n\n## 1. A\n\n## 1. B\n', { anchor: 'article' }), /en double/);
  assert.throws(() => renderLicence('# Titre\n\nVersion 1.0\n\n## 1. A\n\n# Autre\n', { anchor: 'article' }), /Un seul titre/);
});
