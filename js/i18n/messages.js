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
 * La série « Comment marche le Web » (/learn/, version 1.14.0), en français et en anglais d'abord : les
 * autres langues mènent à la page anglaise tant que leur voix n'est pas enregistrée. Hors de vue-i18n
 * (la page n'a pas d'îlot Vue). Les épisodes tutoient, comme leur voix ; les textes de la page évitent
 * de s'adresser au visiteur. Les sous-titres (dix par épisode, 35 caractères au plus) suivent la voix.
 */
export const learnPage = {
  fr: {
    meta: {
      title: 'Comment marche le Web, épisode 1 : que se passe-t-il quand on ouvre une page ?',
      description:
        'Une page web voyage d’un téléphone à un serveur et revient : une demande, un fichier HTML, puis le CSS et le JavaScript. L’épisode 1 en 40 secondes, à regarder ou à parcourir pas à pas.',
    },
    series: 'Comment marche le Web',
    episode: 'Épisode 1',
    title: 'Que se passe-t-il quand on ouvre une page web ?',
    lede: 'Cinq étapes en une seconde environ, sur un plan de métro : la demande part sur la ligne verte, la page revient sur les lignes rouge, bleue et ambre.',
    stage: 'Animation : une demande part d’un téléphone vers un serveur, qui renvoie un fichier HTML, puis le CSS et le JavaScript ; la page se construit dans le navigateur du téléphone.',
    noscript: 'L’animation demande JavaScript. Le texte de l’épisode est juste en dessous.',
    controls: { play: 'Lire', pause: 'Pause', replay: 'Revoir', back: 'Précédent', next: 'Suivant', steps: 'Étapes de l’épisode' },
    beats: ['Demander', 'Répondre', 'Construire', 'Habiller', 'Réveiller', 'Fini'],
    transcript: 'Ce que dit l’épisode',
    narration: [
      'Tu touches un lien. Ton téléphone envoie un petit message sur Internet : « Je peux avoir cette page ? »',
      'Un serveur, un ordinateur au loin, répond avec un fichier texte. Juste du texte, avec des étiquettes.',
      'Ton navigateur lit ces étiquettes et construit des boîtes : un titre, un paragraphe, une image, un bouton.',
      'Puis il demande un fichier de style, le CSS : couleurs, tailles, espaces. Mêmes boîtes, nouveaux habits.',
      'Enfin arrive un script, le JavaScript. Et maintenant, le bouton réagit quand tu le touches.',
      'Du texte en entrée, une page en sortie, en une seconde environ. La prochaine fois : ce que cache ce fichier.',
    ],
    captions: [
      'Tu touches un lien',
      '« Je peux avoir cette page ? »',
      'Un serveur répond',
      'Du texte, avec des étiquettes',
      'Chaque étiquette, une boîte',
      'CSS : couleurs, tailles, espaces',
      'Mêmes boîtes, nouveaux habits',
      'JavaScript réveille le bouton',
      'Du texte entre, une page sort',
      'La suite : ce que cache ce fichier',
    ],
    otherLanguage: 'English',
  },
  en: {
    meta: {
      title: 'How the web works, episode 1: what happens when you open a web page?',
      description:
        'A web page travels from a phone to a server and back: a request, an HTML file, then CSS and JavaScript. Episode 1 in 40 seconds, to watch or to step through.',
    },
    series: 'How the web works',
    episode: 'Episode 1',
    title: 'What happens when you open a web page?',
    lede: 'Five steps in about a second, on a metro map: the request leaves on the green line, the page comes back on the red, blue and amber lines.',
    stage: 'Animation: a request travels from a phone to a server, which sends back an HTML file, then CSS and JavaScript; the page builds in the phone’s browser.',
    noscript: 'The animation needs JavaScript. The episode’s text is just below.',
    controls: { play: 'Play', pause: 'Pause', replay: 'Replay', back: 'Back', next: 'Next', steps: 'Steps of the episode' },
    beats: ['Ask', 'Answer', 'Build', 'Dress', 'Wake', 'Done'],
    transcript: 'What the episode says',
    narration: [
      'You tap a link. Your phone sends a tiny message across the internet: can I have this page, please?',
      'A server, another computer far away, answers. It sends back a text file. Just text, with labels.',
      'Your browser reads the labels and builds boxes: a title, a paragraph, a picture, a button.',
      'Then it asks for a style file, called CSS. Colours, sizes, spacing. Same boxes, new clothes.',
      'Last, a script arrives: JavaScript. Now the button actually does something when you tap it.',
      'Text in, a page out, in about a second. Next time: what’s inside that text file.',
    ],
    captions: [
      'You tap a link',
      '“Can I have this page?”',
      'A server answers',
      'Just text, with labels',
      'Labels become boxes',
      'CSS: colours, sizes, spacing',
      'Same boxes, new clothes',
      'JavaScript wakes the button',
      'Text in. A page out.',
      'Next: what’s in that file',
    ],
    otherLanguage: 'Français',
  },
};

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
