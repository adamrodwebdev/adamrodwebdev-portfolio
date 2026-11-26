/**
 * Projets affichés dans les deux carrousels de l'accueil (1.17.0) : « Réalisations » (sites et applications,
 * ce qu'un client peut commander) et « Créations » (jeux et expériences).
 * Les textes (titre, description, étiquettes, libellé du lien) sont traduits dans js/i18n/locales/<langue>.js,
 * sous projects.<id>.
 *
 * Pour ajouter un projet : ajoutez un objet ici ET ses textes dans chaque langue.
 *  - group  : 'work' (Réalisations) ou 'lab' (Créations)
 *  - status : 'live' (en ligne), 'dev' (en développement) ou 'soon' (à venir)
 *  - url    : lien vers le projet (laisser vide si non publié)
 *  - play   : pour un jeu, une adresse par plateforme où y jouer, dans l'ordre d'affichage
 *             ({ playgama: '…' }, plateformes connues : js/data/platforms.js) ; remplace url
 *  - newTab : true pour ouvrir le lien dans un nouvel onglet (automatique pour les liens externes)
 *  - art    : 'catapult', 'bastion', 'darts', 'plumb', 'cordeau', 'marbles', 'lumirift', 'reel', 'cocorico' ou 'classified'
 *             (illustration générée)
 *  - image  : 'assets/projets/mon-projet.webp' (prioritaire sur art si renseigné)
 */
export const projects = [
  { id: 'skull-darts-71', group: 'work', status: 'live', url: 'https://skulldarts71.fr', art: 'darts' },
  { id: 'plumb', group: 'work', status: 'live', url: 'https://adamrodwebdev.github.io/plumb-darts/', art: 'plumb' },
  { id: 'aplomb-cordeau', group: 'work', status: 'live', url: 'https://adamrodwebdev.github.io/aplomb-cordeau/', art: 'cordeau' },
  // Application privée qui tourne sur le PC de la maison (dépôt privé, aucun serveur) : pas de lien.
  { id: 'cocorico', group: 'work', status: 'dev', art: 'cocorico' },
  { id: 'projet-04', group: 'work', status: 'soon', url: '#contact', art: 'classified' },
  { id: 'catapulte-mania', group: 'lab', status: 'live', play: { playgama: 'https://playgama.ai/play/zifjwuawwwnzl2' }, art: 'catapult' },
  { id: 'bastion', group: 'lab', status: 'live', play: { playgama: 'https://playgama.ai/play/4f2wgyuhvp' }, art: 'bastion' },
  // Pas encore sur Playgama : sa fiche y mènera dès que la page du jeu existera.
  { id: 'ballmania', group: 'lab', status: 'live', play: { playgama: 'https://playgama.ai/play/iysnewqq64' }, art: 'marbles' },
  { id: 'lumirift', group: 'lab', status: 'live', play: { playgama: 'https://playgama.ai/play/be4bqnmqcv' }, art: 'lumirift' },
  { id: 'short-reel', group: 'lab', status: 'live', url: 'https://adamrodwebtech.itch.io/short-reel', art: 'reel' },
  { id: 'projet-03', group: 'lab', status: 'dev', url: '', art: 'classified' },
];

/** Les deux carrousels, dans l'ordre de la page : leur groupe et l'élément où chacun se monte. */
export const PROJECT_GROUPS = Object.freeze({ work: '#projects-app', lab: '#creations-app' });

/** Les projets d'un groupe, dans l'ordre de la liste. */
export const projectsOf = (group) => projects.filter((project) => project.group === group);
