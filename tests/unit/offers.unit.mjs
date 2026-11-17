/**
 * Tests unitaires de l'offre commerciale (1.17.0), lancés par `npm run test:unit` (node:test, sans navigateur) :
 * les prix dans chaque langue, le lecteur des liens sortants et sa table d'entrées hostiles, les blocs absents
 * tant que leur donnée manque, les témoignages échappés, les données structurées.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { messages } from '../../js/i18n/messages.js';
import { PROJECT_TYPES, plans, care } from '../../js/data/offers.js';
import { euros, outbound, offersPanel, testimonialsBlock, heroSecondCta, contactBooking, maltFact, ldOffers } from '../../scripts/offers.mjs';

const fr = messages.fr;

test('les prix suivent la langue de la page, sans espace où couper la ligne', () => {
  const plain = (s) => s.replace(/[  ]/g, ' ');
  assert.equal(plain(euros(1200, 'fr-FR')), '1 200 €');
  assert.equal(euros(1200, 'en'), '€1,200');
  assert.equal(plain(euros(1200, 'it')), '1200 €');
  assert.equal(plain(euros(49, 'es')), '49 €');
  for (const locale of ['fr-FR', 'ru', 'it', 'es']) assert.ok(!euros(2200, locale).includes(' '), locale);
  // La police signature n'a pas l'espace fine insécable : jamais de U+202F dans un prix
  for (const locale of ['fr-FR', 'ru']) assert.ok(!euros(2200, locale).includes(' '), locale);
});

test('un lien sortant vide ne génère rien', () => {
  assert.equal(outbound('bookingUrl', { bookingUrl: '' }), '');
  assert.equal(heroSecondCta(fr, { bookingUrl: '' }).includes('href="#contact"'), true);
  assert.equal(contactBooking(fr, { bookingUrl: '' }), '');
  assert.equal(maltFact(fr, { maltUrl: '' }), '');
});

test('un lien sortant admis s’ouvre dans un nouvel onglet, sans accès à la page', () => {
  const settings = { bookingUrl: 'https://cal.com/adamrodwebtech/15min', maltUrl: 'https://www.malt.fr/profile/adamrodwebtech' };
  for (const html of [heroSecondCta(fr, settings), contactBooking(fr, settings), maltFact(fr, settings)]) {
    assert.match(html, /target="_blank" rel="noopener"/);
    assert.match(html, /nouvel onglet/);
  }
  assert.match(heroSecondCta(fr, settings), /href="https:\/\/cal\.com\/adamrodwebtech\/15min"/);
  assert.match(maltFact(fr, settings), /href="https:\/\/www\.malt\.fr\/profile\/adamrodwebtech"/);
});

test('les liens sortants hostiles font échouer la génération', () => {
  const hostile = [
    'http://cal.com/adam',            // pas https
    'https://cal.com.evil.example/x', // autre domaine qui commence pareil
    'https://evil.example/cal.com',
    'https://moi:secret@cal.com/x',   // identifiants dans l'adresse
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//cal.com/adam',                 // relative au protocole : illisible seule
    'cal.com/adam',
    ' ',
  ];
  for (const value of hostile) assert.throws(() => outbound('bookingUrl', { bookingUrl: value }), Error, value);
  for (const value of [42, null, undefined, ['https://cal.com/x'], { href: 'https://cal.com/x' }]) {
    assert.throws(() => outbound('bookingUrl', { bookingUrl: value }), Error, String(value));
  }
  // Un domaine admis pour l'un ne l'est pas pour l'autre
  assert.throws(() => outbound('maltUrl', { maltUrl: 'https://cal.com/x' }));
});

test('le panneau des offres : trois formules, la recommandée, des boutons vers des types connus', () => {
  const html = offersPanel(fr, 'fr-FR');
  assert.equal((html.match(/class="offer(?: offer--pick)?"/g) || []).length, plans.length);
  assert.equal((html.match(/offer--pick/g) || []).length, 1);
  assert.equal((html.match(/<li><h4 class="care__name">/g) || []).length, care.length);
  for (const [, key] of html.matchAll(/data-project-type="([^"]+)"/g)) assert.ok(Object.hasOwn(PROJECT_TYPES, key), key);
  assert.match(html, /TVA non applicable/);
});

test('chaque langue a le même nombre de types de projet que la liste fermée', () => {
  for (const [lang, m] of Object.entries(messages)) {
    assert.equal(m.form.types.length, Object.keys(PROJECT_TYPES).length, lang);
  }
});

test('pas de témoignage tant qu’il n’y a pas de vrai avis', () => {
  assert.equal(testimonialsBlock(fr, 'fr', []), '');
});

test('un témoignage est échappé, et un avis incomplet fait échouer la génération', () => {
  const entry = { name: 'Camille <b>', role: { fr: 'Gérante' }, quote: { fr: '<script>alert(1)</script>' } };
  const html = testimonialsBlock(fr, 'fr', [entry]);
  assert.ok(!html.includes('<script>') && html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Camille &lt;b&gt;'));
  assert.throws(() => testimonialsBlock(fr, 'en', [entry]));            // pas de texte anglais
  assert.throws(() => testimonialsBlock(fr, 'fr', [{ ...entry, url: 'http://site.example' }]));
});

test('les données structurées listent les offres à prix connu', () => {
  const offers = JSON.parse(ldOffers(fr));
  assert.equal(offers.length, plans.filter((plan) => plan.price !== null).length + care.length + 1);
  assert.ok(offers.every((offer) => offer.priceCurrency === 'EUR' && offer.itemOffered.name));
  assert.equal(offers.find((offer) => offer.priceSpecification.unitCode === 'MON').priceSpecification.price, 49);
});
