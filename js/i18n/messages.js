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
      title: 'Comment marche le Web, épisode 1 : le voyage d’une page',
      description:
        'Ce qui se passe quand on touche un lien, expliqué à partir de zéro : le message voyage par Internet en 0 et en 1 jusqu’à un serveur, qui renvoie la page en trois fichiers. L’épisode 1 en 50 secondes, à regarder ou à parcourir pas à pas.',
    },
    series: 'Comment marche le Web',
    episode: 'Épisode 1',
    title: 'Le voyage d’une page',
    lede: 'Ce qui se passe entre le moment où l’on touche un lien et celui où la page arrive, sans aucun mot laissé à deviner : chaque mot est expliqué avant d’être employé.',
    stage: 'Animation : un téléphone envoie un message par Internet, des appareils reliés par des câbles et des ondes radio ; le message devient des 0 et des 1 et arrive à un serveur, allumé jour et nuit, qui renvoie trois documents au téléphone.',
    noscript: 'L’animation demande JavaScript. Le texte de l’épisode est juste en dessous.',
    controls: { play: 'Lire', pause: 'Pause', replay: 'Revoir', back: 'Précédent', next: 'Suivant', steps: 'Étapes de l’épisode' },
    beats: ['Demander', 'Internet', 'Binaire', 'Serveur', 'Retour', 'Fini'],
    transcript: 'Ce que dit l’épisode',
    narration: [
      'Tu touches un lien : un mot ou un bouton qui ouvre une autre page. Ton téléphone envoie alors un petit message : « Je peux avoir cette page ? »',
      'Ce message voyage par Internet : des câbles et des ondes radio, comme le Wi-Fi ou la 4G, qui relient les téléphones et les ordinateurs du monde entier.',
      'Il y voyage en 0 et en 1. C’est le binaire : le seul langage que les machines comprennent.',
      'Il arrive à un serveur : un ordinateur allumé jour et nuit, qui garde des pages et les envoie à qui les demande. Comme un serveur au restaurant : tu demandes, il te l’apporte.',
      'Le serveur te renvoie la page, en trois fichiers : trois documents. La prochaine fois : ce qu’il y a dedans.',
    ],
    captions: [
      'Tu touches un lien',
      'Un lien ouvre une autre page',
      '« Je peux avoir cette page ? »',
      'Internet : câbles et ondes radio',
      'qui relient le monde entier',
      'En 0 et en 1 : le binaire',
      'Le seul langage des machines',
      'Un serveur : allumé jour et nuit',
      'Il garde des pages et les envoie',
      'Tu demandes, il te l’apporte',
      'La page : trois fichiers',
      'La suite : ce qu’il y a dedans',
    ],
    glossaryTitle: 'Les mots de l’épisode',
    glossary: [
      ['Le Web', 'toutes les pages qu’on ouvre grâce à Internet.'],
      ['Un lien', 'un mot ou un bouton qui ouvre une autre page.'],
      ['Internet', 'des câbles et des ondes radio, comme le Wi-Fi ou la 4G, qui relient les téléphones et les ordinateurs du monde entier pour qu’ils s’envoient des messages.'],
      ['Une demande', 'le message envoyé à un serveur pour obtenir une page.'],
      ['Le binaire', 'une façon d’écrire avec deux chiffres seulement, 0 et 1 : le seul langage que les machines comprennent.'],
      ['Un serveur', 'un ordinateur allumé jour et nuit, qui garde des pages et les envoie à qui les demande, comme un serveur au restaurant.'],
      ['Un fichier', 'un document enregistré dans un ordinateur.'],
    ],
    otherLanguage: 'English',
  },
  en: {
    meta: {
      title: 'How the web works, episode 1: a page’s journey',
      description:
        'What happens when you tap a link, explained from scratch: the message travels over the internet as 0s and 1s to a server, which sends the page back in three files. Episode 1 in 50 seconds, to watch or to step through.',
    },
    series: 'How the web works',
    episode: 'Episode 1',
    title: 'A page’s journey',
    lede: 'What happens between tapping a link and the page arriving, with no word left to guesswork: every word is explained before it is used.',
    stage: 'Animation: a phone sends a message over the internet, devices linked by cables and radio waves; the message becomes 0s and 1s and reaches a server, on day and night, which sends three documents back to the phone.',
    noscript: 'The animation needs JavaScript. The episode’s text is just below.',
    controls: { play: 'Play', pause: 'Pause', replay: 'Replay', back: 'Back', next: 'Next', steps: 'Steps of the episode' },
    beats: ['Ask', 'Internet', 'Binary', 'Server', 'Return', 'Done'],
    transcript: 'What the episode says',
    narration: [
      'You tap a link: a word or a button that opens another page. Your phone then sends a tiny message: “Can I have this page, please?”',
      'That message travels across the internet: cables and radio waves, like Wi-Fi or 4G, that link phones and computers all over the world.',
      'It travels as 0s and 1s. That’s binary: the only language machines understand.',
      'It reaches a server: a computer that stays on day and night, keeps pages, and sends them to whoever asks. Like a server in a restaurant: you ask, and it brings it to you.',
      'The server sends the page back, in three files: three documents. Next time: what’s inside them.',
    ],
    captions: [
      'You tap a link',
      'A link opens another page',
      '“Can I have this page?”',
      'The internet: cables, radio waves',
      'linking the whole world',
      'It travels as 0s and 1s',
      'Machines only understand binary',
      'A server: on day and night',
      'It keeps pages and sends them',
      'You ask, it brings it to you',
      'The page: three files',
      'Next: what’s inside them',
    ],
    glossaryTitle: 'The words of the episode',
    glossary: [
      ['The web', 'all the pages you can open thanks to the internet.'],
      ['A link', 'a word or a button that opens another page.'],
      ['The internet', 'cables and radio waves, like Wi-Fi or 4G, that link phones and computers all over the world so they can send each other messages.'],
      ['A request', 'the message sent to a server to get a page.'],
      ['Binary', 'a way of writing with only two digits, 0 and 1: the only language machines understand.'],
      ['A server', 'a computer that stays on day and night, keeps pages and sends them to whoever asks, like a server in a restaurant.'],
      ['A file', 'a document stored on a computer.'],
    ],
    otherLanguage: 'Français',
  },
};

/**
 * L'épisode 2 de la série, « Trois langages » (texte final du 16 novembre 2026, validé par l'utilisateur) :
 * sa voix et ses dix-sept sous-titres, en français et en anglais. Pas encore branché : sa mise en scène
 * (js/learn/episode02.js) sera réécrite sur ce texte, avec la silhouette (le squelette, les vêtements et
 * la coiffure, le cerveau).
 */
export const learnEpisode2 = {
  fr: {
    title: 'Trois langages',
    narration: [
      'Une machine ne comprend que le binaire : des 0 et des 1. Mais cette page arrive en trois fichiers, écrits en trois langages : des mots et des signes que les humains savent lire. Ton navigateur, l’appli qui affiche les pages, les traduit pour la machine.',
      'D’abord le HTML : HyperText Markup Language, en français langage de balisage hypertexte. Hypertexte : du texte avec des liens. Balisage : des étiquettes, appelées balises, qui disent « ceci est un titre ». Le navigateur en fait des boîtes : c’est le squelette de la page, comme les os d’une personne.',
      'Puis le CSS : Cascading Style Sheets, feuilles de style en cascade. Des règles de couleurs, de tailles, d’espaces : l’apparence, comme les vêtements et la coiffure. En cascade : si plusieurs règles visent la même boîte, la plus précise gagne.',
      'Enfin le JavaScript, un langage de programmation : il sert à écrire un script, des instructions que le navigateur suit pas à pas. C’est le cerveau de la page : il fait les calculs. Grâce à ce script, le bouton réagit quand tu le touches.',
      'Trois langages pour les humains, traduits en 0 et en 1 pour la machine. Et la page s’affiche.',
    ],
    captions: [
      'Une machine : que des 0 et des 1',
      'Trois fichiers, trois langages',
      'Des mots que les humains lisent',
      'Le navigateur traduit',
      'HTML : HyperText Markup Language',
      'Hypertexte : texte avec des liens',
      'Balises : des étiquettes',
      'Le squelette de la page',
      'CSS : Cascading Style Sheets',
      'L’apparence : vêtements, coiffure',
      'La règle la plus précise gagne',
      'JavaScript : un script',
      'des instructions, pas à pas',
      'Le cerveau : il fait les calculs',
      'Le bouton réagit',
      'Trois langages pour les humains',
      'traduits en 0 et en 1',
    ],
  },
  en: {
    title: 'Three languages',
    narration: [
      'A machine only understands binary: 0s and 1s. But this page arrives in three files, written in three languages: words and symbols that humans can read. Your browser, the app that shows web pages, translates them for the machine.',
      'First, HTML: HyperText Markup Language. Hypertext: text with links. Markup: labels, called tags, that say “this is a title”. The browser turns them into boxes: the page’s skeleton, like the bones of a person.',
      'Then CSS: Cascading Style Sheets. Rules for colours, sizes and spacing: the look, like clothes and a hairstyle. Cascading: when several rules aim at the same box, the most specific one wins.',
      'Last, JavaScript, a programming language: it’s used to write a script, instructions the browser follows step by step. It’s the page’s brain: it does the calculations. Thanks to this script, the button reacts when you tap it.',
      'Three languages for humans, translated into 0s and 1s for the machine. And the page appears.',
    ],
    captions: [
      'A machine: only 0s and 1s',
      'Three files, three languages',
      'Words and symbols for humans',
      'Your browser translates',
      'HTML: HyperText Markup Language',
      'Hypertext: text with links',
      'Markup: labels, called tags',
      'The page’s skeleton',
      'CSS: Cascading Style Sheets',
      'The look: clothes, hairstyle',
      'The most specific rule wins',
      'JavaScript: a script',
      'instructions, step by step',
      'The brain: it does calculations',
      'The button reacts',
      'Three languages for humans',
      'translated into 0s and 1s',
    ],
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
