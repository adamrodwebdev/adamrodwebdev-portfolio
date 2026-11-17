/**
 * Les offres de l'accueil (1.17.0), prix validés le 17 novembre 2026 : nets, en euros entiers, « à partir de »
 * et ouverts à la discussion (micro-entreprise : TVA non applicable, article 293 B du CGI).
 * Les textes de chaque offre sont dans js/i18n/locales/<langue>.js, sous offers.<id>.
 *
 *  - price : prix d'appel en euros (null = sur devis)
 *  - pick  : l'offre mise en avant (une seule)
 *  - type  : le type de projet que son bouton choisit dans le formulaire (clé de PROJECT_TYPES)
 */
export const plans = Object.freeze([
  Object.freeze({ id: 'essential', price: 1200, pick: false, type: 'showcase' }),
  Object.freeze({ id: 'complete', price: 2200, pick: true, type: 'showcase' }),
  Object.freeze({ id: 'app', price: null, pick: false, type: 'app' }),
]);

/** La maintenance et l'hébergement, par mois, du plus léger au plus suivi. */
export const care = Object.freeze([
  Object.freeze({ id: 'watch', monthly: 49 }),
  Object.freeze({ id: 'follow', monthly: 79 }),
  Object.freeze({ id: 'partner', monthly: 99 }),
]);

/** Le pré-audit d'accessibilité, à prix fixe. */
export const audit = Object.freeze({ price: 390, type: 'audit' });

/**
 * Les types de projet du formulaire, dans l'ordre de form.types de chaque langue : un bouton d'offre en choisit
 * un par sa clé (attribut data-project-type), lue dans cette liste fermée et jamais ailleurs.
 */
export const PROJECT_TYPES = Object.freeze({ showcase: 0, app: 1, redesign: 2, care: 3, audit: 4, seo: 5, other: 6 });
