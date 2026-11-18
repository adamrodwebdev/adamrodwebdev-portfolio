/**
 * Toutes les traductions du site, pour la génération des pages (scripts/build-pages.mjs) et les tests.
 * Le navigateur ne charge pas ce fichier : chaque page importe seulement sa langue (js/i18n/index.js).
 *
 * Textes : js/i18n/locales/<langue>.js, mêmes clés partout. Langues et adresses : js/i18n/languages.js.
 */
import { LANGUAGES } from './languages.js';
import fr from './locales/fr.js';
import en from './locales/en.js';
import ru from './locales/ru.js';
import it from './locales/it.js';
import es from './locales/es.js';

export const messages = { fr, en, ru, it, es };

export const SUPPORTED = LANGUAGES.map((language) => language.code);

/**
 * La page du jeu, /lumirift/ (version 1.8.0), en anglais seulement : scripts/build-pages.mjs la
 * génère à partir de templates/lumirift.html, avec les textes de l'en-tête et du pied de page
 * anglais ci-dessus. Hors de vue-i18n (la page n'a pas d'îlot Vue) : aucune clé à doubler en
 * français. Pas de guillemet droit ni d'esperluette dans les textes repris par le JSON-LD.
 */
export const lumiriftPage = {
  meta: {
    title: 'Lumirift Blocks: free falling sand puzzle in your browser',
    description:
      'Play Lumirift Blocks free in your browser, no download: blocks crumble into sand that burns, shocks and grows, and four Guardian bosses fight back.',
    ogTitle: 'Lumirift Blocks: the falling sand puzzle where blocks fight back',
    ogImageAlt: 'Lumirift Blocks: the Eye of the Tower glares over a glass tower of gem blocks',
  },
  stage: {
    eyebrow: 'A free browser game by AdamRodWebTech',
    promise:
      'A falling sand puzzle where the blocks fight back. Pieces crumble into sand that burns, shocks and grows, and four Guardians rise to stop you.',
    facts: 'No download · phone and desktop',
    languages: 'English, French, Indonesian, Russian',
  },
  play: { label: 'Play free', where: 'on Playgama' },
  clip: {
    alt: 'Fire lands on a pool of oil and the whole pool blazes in the sand well',
    play: 'Play the clip',
    pause: 'Pause the clip',
  },
  features: {
    title: 'What makes it different',
    sand: {
      title: 'Sand that reacts',
      text: 'Fire sets oil ablaze, lightning shocks water, seeds grow into vines, acid eats and ice freezes. Seven elements, one well.',
      alt: 'Lightning strikes a pool of water and shocks the sand around it',
    },
    guardians: {
      title: 'Four Guardians',
      text: 'The Dune Wyrm, the Ceramic Golem, the Eye of the Tower and the Heart of the Rift, and a new one to beat every week.',
      alt: 'The Dune Wyrm bursts out of the sand and a bolt strikes its head',
    },
    modes: {
      title: '14 ways to play',
      text: 'A 69-level campaign, a race against the clock, seasons, and a gift every day.',
      alt: 'Rubble rows burst with the word RIFT over the Heart of the Rift',
    },
  },
  maker: {
    title: 'Made in public',
    line: 'Built by AdamRodWebTech, a full-stack web developer in France. The bugs, fixes and tricks behind it go out every week.',
    proofs: {
      size: 'Starts in under 300 KB',
      lighthouse: 'Lighthouse 100',
      bots: 'Every level played by bots first',
    },
    links: {
      youtube: 'YouTube',
      github: 'Code on GitHub',
      tiktok: 'TikTok',
      instagram: 'Instagram',
      hire: 'Hire me',
    },
    credits: 'Designed and directed by AdamRodWebTech, built with AI coding assistants.',
  },
  ld: {
    description:
      'A free falling sand puzzle in your browser: blocks crumble into sand that burns, shocks and grows, and four Guardian bosses fight back.',
    trailerName: 'Lumirift Blocks: fire meets oil',
    trailerDescription: 'Fire lands on a pool of oil and the whole pool blazes.',
  },
};

/**
 * La licence des polices Ressac (1.18.0), /ressac/licence/ et /en/ressac/licence/ : les textes de la page autour
 * de la licence (scripts/licence-pages.mjs, templates/ressac/licence.html). La licence elle-même vient de la
 * fonderie, mot pour mot (templates/ressac/EULA.<langue>.md) : rien ici ne la reformule.
 * `other` parle dans la langue de l'autre page, vers laquelle il mène.
 */
export const licencePage = {
  fr: {
    meta: {
      title: 'Licence des polices Ressac (CLUF) | AdamRodWebTech',
      description: 'Le contrat de licence des polices de la fonderie Ressac, version 1.0 : usages permis, licences bureautique, web, application et livre numérique, prix et droit applicable.',
    },
    kicker: 'Fonderie Ressac',
    notice: 'Cette licence existe aussi en anglais. En cas d’écart, la version française prévaut.',
    toc: 'Sommaire',
    back: 'Revenir au sommaire',
    other: { label: 'Read the English version', short: 'English version' },
  },
  en: {
    meta: {
      title: 'Ressac Font Licence (EULA) | AdamRodWebTech',
      description: 'The licence agreement for the fonts of the Ressac type foundry, version 1.0: what you may do, desktop, web, app and e-book licences, prices and governing law.',
    },
    kicker: 'Ressac type foundry',
    notice: 'This licence also exists in French. If the two differ, the French version prevails.',
    toc: 'Contents',
    back: 'Back to contents',
    other: { label: 'Lire la version française', short: 'Version française' },
  },
};
