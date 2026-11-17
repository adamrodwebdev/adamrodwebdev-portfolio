/**
 * L'offre commerciale de l'accueil (1.17.0), rendue à la génération : HTML statique, rien n'attend JavaScript.
 *  - le panneau « Offres » : formules, maintenance, pré-audit, prix formatés dans la langue de la page ;
 *  - les témoignages, absents tant que js/data/testimonials.js est vide ;
 *  - les liens vers l'agenda et le profil Malt, absents tant que js/config.js ne les donne pas ;
 *  - les offres dans les données structurées (schema.org, makesOffer).
 */
import { plans, care, audit } from '../js/data/offers.js';
import { testimonials } from '../js/data/testimonials.js';
import { config, OUTBOUND_HOSTS } from '../js/config.js';
import { escape } from './html.mjs';

/**
 * Un montant en euros entiers, à la façon de la langue (« 1 200 € », « €1,200 », « 1200 € »). L'espace fine
 * insécable du français (U+202F) devient une espace insécable : la police signature ne dessine pas la première.
 */
export const euros = (amount, locale) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount).replace(/ /g, ' ');

/**
 * Un lien sortant de la configuration : '' s'il n'est pas donné, sinon une adresse https vers un domaine admis.
 * Toute autre valeur fait échouer la génération : rien n'est publié vers une adresse imprévue.
 */
export function outbound(name, settings = config) {
  const value = settings[name];
  if (value === '') return '';
  if (typeof value !== 'string') throw new Error(`config.${name} : une adresse ou une chaîne vide`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`config.${name} : adresse illisible`);
  }
  const hosts = OUTBOUND_HOSTS[name];
  if (url.protocol !== 'https:' || !hosts || !hosts.includes(url.hostname) || url.username || url.password) {
    throw new Error(`config.${name} : https et ${hosts ? hosts.join(' ou ') : 'aucun domaine admis'} seulement`);
  }
  return url.href;
}

/** Les attributs d'un lien qui ouvre un autre site dans un nouvel onglet. */
const away = (href) => `href="${escape(href)}" target="_blank" rel="noopener"`;

// Sans « reveal » (1.17.0) : le flou d'apparition sur ces grandes cartes allongeait d'autant la mise en
// page de l'arrivée des polices ; l'en-tête de la section garde son apparition, comme partout.
function planCard(plan, o, locale) {
  const text = o.plans[plan.id];
  const price = plan.price === null
    ? `<p class="offer__price offer__price--quote">${escape(o.quote)}</p>`
    : `<p class="offer__price"><small>${escape(o.from)}</small> ${escape(euros(plan.price, locale))}</p>`;
  const items = text.items.map((item) => `<li>${escape(item)}</li>`).join('');
  return `<li class="offer${plan.pick ? ' offer--pick' : ''}">
            ${plan.pick ? `<p class="offer__badge">${escape(o.recommended)}</p>` : ''}
            <h3 class="offer__name">${escape(text.name)}</h3>
            ${price}
            <p class="offer__for">${escape(text.for)}</p>
            <ul class="offer__list" role="list">${items}</ul>
            <a class="btn ${plan.pick ? 'btn--gold' : 'btn--ghost'} offer__cta" href="#contact" data-project-type="${plan.type}"><span>${escape(text.cta)}</span></a>
          </li>`;
}

/** Le contenu du panneau « Offres » sous son en-tête : formules, maintenance, pré-audit, mentions. */
export function offersPanel(texts, locale) {
  const o = texts.offers;
  const tiers = care.map((tier) => {
    const text = o.care[tier.id];
    return `<li><h4 class="care__name">${escape(text.name)}</h4><p class="care__price">${escape(euros(tier.monthly, locale))}<small>${escape(o.perMonth)}</small></p><p class="care__text">${escape(text.text)}</p></li>`;
  }).join('');
  return `<ul class="offers" role="list">
          ${plans.map((plan) => planCard(plan, o, locale)).join('\n          ')}
        </ul>

        <div class="care">
          <h3 class="care__title">${escape(o.care.title)}</h3>
          <ul class="care__tiers" role="list">${tiers}</ul>
          <p class="care__more"><a class="link-arrow" href="#contact" data-project-type="care">${escape(o.care.cta)}</a></p>
        </div>

        <div class="audit">
          <div class="audit__copy">
            <h3 class="care__title">${escape(o.audit.title)}</h3>
            <p>${escape(o.audit.text)}</p>
            <p class="audit__law">${escape(o.audit.law)}</p>
          </div>
          <div class="audit__side">
            <p class="offer__price"><small>${escape(o.fixed)}</small> ${escape(euros(audit.price, locale))}</p>
            <a class="btn btn--ghost" href="#contact" data-project-type="${audit.type}"><span>${escape(o.audit.cta)}</span></a>
          </div>
        </div>

        <p class="offers__legal">${escape(o.legal)}</p>`;
}

/** Les témoignages : rien tant qu'il n'y a pas de vrai avis. Un avis incomplet fait échouer la génération. */
export function testimonialsBlock(texts, lang, list = testimonials) {
  if (list.length === 0) return '';
  const items = list.map((entry, i) => {
    const quote = entry.quote?.[lang];
    const role = entry.role?.[lang];
    if (typeof entry.name !== 'string' || typeof quote !== 'string' || typeof role !== 'string') {
      throw new Error(`Témoignage ${i + 1} incomplet en ${lang} : nom, rôle et citation dans chaque langue`);
    }
    const author = entry.url ? `<a ${away(outboundTestimonial(entry.url, i))}>${escape(entry.name)}</a>` : escape(entry.name);
    return `<li><figure class="testimonial"><blockquote><p>${escape(quote)}</p></blockquote><figcaption><b>${author}</b>, ${escape(role)}</figcaption></figure></li>`;
  }).join('');
  return `<div class="testimonials">
          <h3 class="care__title">${escape(texts.offers.testimonials)}</h3>
          <ul class="testimonials__list" role="list">${items}</ul>
        </div>`;
}

/** L'adresse d'un site réalisé, citée avec un avis : https seulement. */
function outboundTestimonial(value, i) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`Témoignage ${i + 1} : adresse https seulement`);
  return url.href;
}

/** Le second bouton du héros : réserver un appel si l'agenda existe, sinon démarrer un projet. */
export function heroSecondCta(texts, settings = config) {
  const booking = outbound('bookingUrl', settings);
  return booking
    ? `<a class="btn btn--ghost magnetic" ${away(booking)}><span>${escape(texts.hero.ctaBooking)}</span><span class="visually-hidden"> ${escape(texts.a11y.newTab)}</span></a>`
    : `<a class="btn btn--ghost magnetic" href="#contact"><span>${escape(texts.hero.ctaContact)}</span></a>`;
}

/** Le bouton de réservation du contact, absent sans agenda. */
export function contactBooking(texts, settings = config) {
  const booking = outbound('bookingUrl', settings);
  return booking
    ? `<p class="contact__booking"><a class="btn btn--gold" ${away(booking)}><span>${escape(texts.contactSection.booking)}</span><span class="visually-hidden"> ${escape(texts.a11y.newTab)}</span></a></p>`
    : '';
}

/** La ligne « Malt » des coordonnées, absente sans profil. */
export function maltFact(texts, settings = config) {
  const malt = outbound('maltUrl', settings);
  return malt
    ? `<div><dt>Malt</dt><dd><a ${away(malt)}>${escape(texts.contactSection.maltValue)}<span class="visually-hidden"> ${escape(texts.a11y.newTab)}</span></a></dd></div>`
    : '';
}

/** Les offres à prix connu, pour schema.org (makesOffer d'un ProfessionalService) : une liste JSON. */
export function ldOffers(texts) {
  const o = texts.offers;
  const offer = (name, description, price, unit) => ({
    '@type': 'Offer',
    priceCurrency: 'EUR',
    priceSpecification: unit
      ? { '@type': 'UnitPriceSpecification', price, priceCurrency: 'EUR', unitCode: unit }
      : { '@type': 'PriceSpecification', minPrice: price, priceCurrency: 'EUR' },
    itemOffered: { '@type': 'Service', name, description },
  });
  return JSON.stringify([
    ...plans.filter((plan) => plan.price !== null).map((plan) => offer(o.plans[plan.id].name, o.plans[plan.id].for, plan.price)),
    ...care.map((tier) => offer(`${o.care.title} (${o.care[tier.id].name})`, o.care[tier.id].text, tier.monthly, 'MON')),
    offer(o.audit.title, o.audit.text, audit.price),
  ]);
}
