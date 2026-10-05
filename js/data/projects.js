/**
 * Liste des projets affichés dans le carrousel.
 * Pour ajouter un projet : copiez un objet, changez les champs, c'est tout.
 *  - status : 'live' (en ligne), 'dev' (en développement) ou 'soon' (à venir)
 *  - url    : lien vers le projet (laisser vide si non publié)
 *  - newTab : true pour ouvrir le lien dans un nouvel onglet (automatique pour les liens externes)
 *  - art    : 'catapult', 'bastion' ou 'classified' (illustration générée)
 *            ou image : 'assets/projets/mon-projet.webp' (prioritaire si renseigné)
 */
export const projects = [
  {
    id: 'catapulte-mania',
    title: 'Catapulte Mania',
    status: 'live',
    description: "Jeu de catapulte médiéval jouable dans le navigateur : 100 niveaux en 10 chapitres, châteaux destructibles, mode solo ou coopération à deux. Moins de 400 Ko, jouable hors ligne.",
    tags: ['Vue 3', 'Vite', 'Physique 2D', 'Audio synthétisé'],
    url: '/demos/catapulte-mania/',
    newTab: true,
    linkLabel: 'Jouer à la démo (8 niveaux)',
    art: 'catapult',
  },
  {
    id: 'bastion',
    title: 'Bastion',
    status: 'live',
    description: 'Tower defense gratuit sur navigateur et mobile : construisez et améliorez vos défenses, déclenchez vos pouvoirs et tenez six niveaux de vagues ennemies.',
    tags: ['Vue 3', 'Tower defense', 'Mobile', 'Mode sombre'],
    url: 'https://bastion-tower-defense.netlify.app',
    linkLabel: 'Jouer à Bastion',
    art: 'bastion',
  },
  {
    id: 'projet-03',
    title: 'Projet classifié',
    status: 'dev',
    description: 'Un nouveau projet est en cours de développement. Les détails seront dévoilés au lancement.',
    tags: ['Vue 3', 'En cours'],
    url: '',
    art: 'classified',
  },
  {
    id: 'projet-04',
    title: 'Votre projet',
    status: 'soon',
    description: 'Cette place est réservée à votre futur site. Décrivez-moi votre idée et construisons-le ensemble.',
    tags: ['Sur mesure'],
    url: '#contact',
    linkLabel: 'Proposer un projet',
    art: 'classified',
  },
];

export const statusLabels = {
  live: 'En ligne',
  dev: 'En développement',
  soon: 'À venir',
};
