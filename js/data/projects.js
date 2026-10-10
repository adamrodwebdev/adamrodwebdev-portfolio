/**
 * Projets affichés dans le carrousel.
 * Les textes (titre, description, étiquettes, libellé du lien) sont traduits
 * dans js/i18n/messages.js, sous projects.<id>, en français et en anglais.
 *
 * Pour ajouter un projet : ajoutez un objet ici ET ses textes dans messages.js.
 *  - status : 'live' (en ligne), 'dev' (en développement) ou 'soon' (à venir)
 *  - url    : lien vers le projet (laisser vide si non publié)
 *  - newTab : true pour ouvrir le lien dans un nouvel onglet (automatique pour les liens externes)
 *  - art    : 'catapult', 'bastion', 'darts' ou 'classified' (illustration générée)
 *  - image  : 'assets/projets/mon-projet.webp' (prioritaire sur art si renseigné)
 */
export const projects = [
  { id: 'catapulte-mania', status: 'live', url: '/demos/catapulte-mania/', newTab: true, art: 'catapult' },
  { id: 'bastion', status: 'live', url: 'https://bastion-tower-defense.netlify.app', art: 'bastion' },
  { id: 'skull-darts-71', status: 'live', url: 'https://skulldarts71.fr', art: 'darts' },
  { id: 'projet-03', status: 'dev', url: '', art: 'classified' },
  { id: 'projet-04', status: 'soon', url: '#contact', art: 'classified' },
];
