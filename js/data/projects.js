/**
 * Projets affichés dans le carrousel.
 * Les textes (titre, description, étiquettes, libellé du lien) sont traduits
 * dans js/i18n/messages.js, sous projects.<id>, en français et en anglais.
 *
 * Pour ajouter un projet : ajoutez un objet ici ET ses textes dans messages.js.
 *  - status : 'live' (en ligne), 'dev' (en développement) ou 'soon' (à venir)
 *  - url    : lien vers le projet (laisser vide si non publié)
 *  - play   : pour un jeu, une adresse par plateforme où y jouer, dans l'ordre d'affichage
 *             ({ playgama: '…' }, plateformes connues : js/data/platforms.js) ; remplace url
 *  - newTab : true pour ouvrir le lien dans un nouvel onglet (automatique pour les liens externes)
 *  - art    : 'catapult', 'bastion', 'darts', 'marbles', 'lumirift' ou 'classified' (illustration générée)
 *  - image  : 'assets/projets/mon-projet.webp' (prioritaire sur art si renseigné)
 */
export const projects = [
  { id: 'catapulte-mania', status: 'live', play: { playgama: 'https://playgama.ai/play/zifjwuawwwnzl2' }, art: 'catapult' },
  { id: 'bastion', status: 'live', play: { playgama: 'https://playgama.ai/play/4f2wgyuhvp' }, art: 'bastion' },
  { id: 'skull-darts-71', status: 'live', url: 'https://skulldarts71.fr', art: 'darts' },
  // Pas encore sur Playgama : sa fiche y mènera dès que la page du jeu existera.
  { id: 'ballmania', status: 'soon', art: 'marbles' },
  { id: 'lumirift', status: 'live', url: '/lumirift/', art: 'lumirift' },
  { id: 'projet-03', status: 'dev', url: '', art: 'classified' },
  { id: 'projet-04', status: 'soon', url: '#contact', art: 'classified' },
];
