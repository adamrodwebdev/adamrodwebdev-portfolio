/**
 * Configuration du site.
 *
 * formMode :
 *  - 'netlify'  : envoi via Netlify Forms (aucun serveur à gérer, recommandé)
 *  - 'endpoint' : envoi JSON vers formEndpoint (Formspree, Web3Forms, votre API…)
 *  - 'demo'     : aucun envoi réel, l'animation de confirmation est jouée (aperçu)
 */
export const config = {
  formMode: 'netlify',
  formEndpoint: '',               // ex. 'https://formspree.io/f/xxxxxxx'
  contactEmail: 'contact@adamrodwebdev.com', // adresse affichée en secours
};
