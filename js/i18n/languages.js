/**
 * Les langues du site (1.10.0), dans l'ordre du menu : la génération des pages, le menu des langues,
 * l'horloge du bandeau et le plan du site s'en servent. Aucun texte ici : ils sont dans locales/<code>.js.
 *
 *  - code : sous-dossier des textes et attribut lang de la page ;
 *  - name : nom de la langue dans cette langue (le menu l'affiche tel quel) ;
 *  - base : adresse de l'accueil ; thanks : page de confirmation du formulaire ;
 *  - legal : mentions légales (en français et en anglais seulement : les autres langues mènent à l'anglaise) ;
 *  - intl : langue de Intl (heure du bandeau).
 *
 * Ajouter une langue : une entrée ici, le fichier locales/<code>.js (mêmes clés que fr.js),
 * un dossier <code>/ avec 404.html et thank-you.html, puis site-files.mjs, netlify.toml et sitemap.xml.
 */
export const LANGUAGES = [
  { code: 'fr', name: 'Français', base: '/', thanks: '/merci.html', legal: '/mentions-legales.html', intl: 'fr-FR' },
  { code: 'en', name: 'English', base: '/en/', thanks: '/en/thank-you.html', legal: '/en/legal-notice.html', intl: 'en-GB' },
  { code: 'ru', name: 'Русский', base: '/ru/', thanks: '/ru/thank-you.html', legal: '/en/legal-notice.html', intl: 'ru-RU' },
  { code: 'it', name: 'Italiano', base: '/it/', thanks: '/it/thank-you.html', legal: '/en/legal-notice.html', intl: 'it-IT' },
  { code: 'es', name: 'Español', base: '/es/', thanks: '/es/thank-you.html', legal: '/en/legal-notice.html', intl: 'es-ES' },
];

/** La langue par défaut du site (x-default, langue de repli). */
export const DEFAULT_LANGUAGE = LANGUAGES[0];

/** La langue d'un code, ou la langue par défaut si le code est inconnu. */
export const languageOf = (code) => LANGUAGES.find((language) => language.code === code) ?? DEFAULT_LANGUAGE;
