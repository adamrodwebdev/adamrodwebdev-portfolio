# Historique des versions

Le projet suit le [versionnage sémantique](https://semver.org/lang/fr/) : MAJEUR.MINEUR.CORRECTIF.

## [1.2.1] - 2026-10-06

### Corrigé
- Le template `templates/index.html` et le dossier `scripts/` étaient accessibles en ligne : ils renvoient désormais une erreur 404.

## [1.2.0] - 2026-10-06

### Ajouté
- Version anglaise du site sur `/en/`, avec sélecteur de langue (FR / EN) dans l'en-tête et le pied de page ; la section affichée est conservée au changement de langue.
- vue-i18n (dernière version 11.x) : tous les composants Vue (menu, carrousel, formulaire, lecteur audio, illustrations) sont traduits.
- `js/i18n/messages.js` : source unique des textes français et anglais.
- `templates/index.html` et `scripts/build-pages.mjs` : génèrent les pages statiques `index.html` et `en/index.html` (référencement), exécutés automatiquement par Netlify.
- Pages anglaises : mentions légales, remerciement et 404.
- Balises `hreflang`, sitemap bilingue, `og:locale:alternate`.

### Modifié
- Adresse canonique : `https://adamrodwebdev.com` (sans www), le domaine principal sur Netlify.
- Les textes des projets sont déplacés de `js/data/projects.js` vers les traductions.

## [1.1.0] - 2026-10-05

### Ajouté
- Démo jouable de Catapulte Mania (8 niveaux) hébergée sur `/demos/catapulte-mania/`, ouverte dans un nouvel onglet depuis le carrousel.
- Option `newTab` pour les liens des projets.

### Corrigé
- Le bouton de Catapulte Mania menait vers la version complète protégée par un verrou d'accès.
- Démo : remplacement du texte `__VITE_PRELOAD__` laissé par Vite, qui bloquait le chargement.

## [1.0.0] - 2026-10-05

Première mise en ligne sur https://adamrodwebdev.com.

### Ajouté
- Site vitrine en HTML, CSS et JavaScript avec îlots Vue 3 (menu, carrousel, formulaire, lecteur audio).
- Thème noir, or et blanc, mode clair et mode sombre avec transition circulaire (View Transitions API).
- Hero animé : éclats dorés sur canvas, emblème hexagonal tracé au chargement, panneau d'interface avec l'heure de Paris.
- Carrousel 3D des projets : Catapulte Mania, Bastion, projet en développement et carte « Votre projet ».
- Formulaire de contact avec validation en direct et animation de confirmation, relié à Netlify Forms.
- Bande-son originale « Ascension » synthétisée en direct (Web Audio API).
- SEO : métadonnées, Open Graph, données structurées JSON-LD, sitemap, robots.txt, manifeste.
- Pages 404, remerciement et mentions légales.
- Configuration Netlify : en-têtes de sécurité et de cache.
