# Historique des versions

Le projet suit le [versionnage sémantique](https://semver.org/lang/fr/) : MAJEUR.MINEUR.CORRECTIF.

## [1.8.0] - 2026-10-28

### Ajouté
- **La page du jeu Lumirift, `/lumirift/`** (en anglais), l'adresse que donnent les réseaux sociaux : le titre du jeu dans sa police, la promesse, le bouton doré « Play free, on Playgama » (même onglet), le clip de 7,8 s filmé par la fabrique de clips du jeu, trois cartes (le sable qui réagit, les quatre Gardiens, quatorze façons de jouer), puis « Made in public » : trois preuves, les liens (devlogs, GitHub, TikTok, Instagram, contact) et la ligne de crédits. En-tête et pied de page du site ; la scène reste violette dans les deux thèmes.
- Le clip ne se charge qu'après la page et un moment de calme, jamais avec le mouvement réduit ni l'économie de données (l'affiche reste, avec un bouton pour le lancer) ; un bouton le met en pause. Son affiche (AVIF et WebP) est le plus grand élément affiché.
- Référencement : titre et description propres, carte de partage du jeu (1200 × 630), données structurées `VideoGame` avec son clip, page ajoutée au plan du site.
- Données structurées de l'accueil : les profils TikTok, YouTube, Instagram et GitHub (`sameAs`).

### Modifié
- La fiche Lumirift du carrousel mène à la page du jeu, plus à la démo : textes à jour (quatorze modes, campagne de 69 niveaux, quatre Gardiens, quatre langues), « 14 MODES » sur l'illustration.
- Le script de génération remplit aussi `lumirift/index.html` (un seul gabarit par page, textes dans `js/i18n/messages.js`).

### Qualité
- Lighthouse 100 dans les quatre catégories, sur mobile (trois passages après un passage de préchauffage) et sur ordinateur ; aucun défilement horizontal de 320 à 2560 px, réorganisation à 320 × 256, cibles de 44 px, aucun script de mesure ni bandeau de cookies.

## [1.7.1] - 2026-10-26

### Corrigé
- Mentions légales complétées (FR / EN) selon les obligations d'un micro-entrepreneur : éditeur Kevin Rousselet, entrepreneur individuel (EI), nom commercial AdamRodWebTech, adresse, téléphone, SIREN et SIRET (RNE), TVA non applicable (article 293 B du CGI), directeur de la publication.
- Hébergeur : coordonnées officielles de Netlify, Inc. (101 2nd Street, San Francisco), l'ancienne adresse n'étant plus valable.

## [1.7.0] - 2026-10-26

### Ajouté
- Adresse e-mail professionnelle **contact@adamrodwebdev.com** affichée dans la section contact, en français et en anglais, avec un lien `mailto:`.
- Cette adresse figure aussi dans les mentions légales (FR / EN), comme l'exige la loi pour l'éditeur d'un site.

### Modifié
- Le script de génération des pages lit l'adresse dans `js/config.js` : une seule source pour le site et le formulaire.

## [1.6.2] - 2026-10-15

### Corrigé
- Carrousel de projets sur téléphone : les flèches et le compteur sortaient de l'écran (sept puces trop larges) ; ils sont remplacés sous 768 px par des segments de progression qui montrent aussi la lecture automatique.
- Les illustrations n'étaient plus écrasées par les longues descriptions (16 px de haut pour Lumirift sur téléphone) : le carrousel prend la hauteur de sa plus haute carte et, jusqu'à 860 px, chaque illustration s'affiche entière.
- Glisser au doigt : la carte suit le doigt au pixel près, le geste n'est plus annulé dès le premier mouvement, un défilement vertical ne change plus de projet par erreur.

### Modifié
- Sur téléphone, piste plate : les cartes voisines dépassent sur les bords et un toucher les amène au centre ; plus de rotation 3D ni de filtres coûteux pendant le glisser.
- Jusqu'à 860 px, descriptions repliées à cinq lignes avec « Lire la suite » et lien d'action aligné en bas de carte.
- La lecture automatique s'arrête dès que le visiteur glisse, touche ou utilise les commandes.

## [1.6.1] - 2026-10-15

### Modifié
- Démo de Ballmania en version 1.4.2 : bouton de coupure du son sur l'écran titre et en jeu, écran titre sans défilement sur les petits téléphones en portrait.

## [1.6.0] - 2026-10-14

### Modifié
- Stackrift s'appelle désormais **Lumirift** : fiche du carrousel, textes FR / EN et contenu statique renommés, démo mise à jour (version 1.5.0 du jeu : identité « Rift », première partie guidée, musique générative) sur `/demos/lumirift/`.
- Les anciens liens `/demos/stackrift/…` redirigent (301) vers `/demos/lumirift/…`.

## [1.5.0] - 2026-10-13

### Ajouté
- Projet **Stackrift** dans le carrousel, en français et en anglais : démo jouable (cinq modes sur treize et le premier chapitre de la campagne) hébergée sur `/demos/stackrift/`, ouverte dans un nouvel onglet et non indexée, comme les autres démos.
- Nouvelle illustration animée `stackrift` : une barre tombe dans un puits presque plein et fait éclater quatre lignes.

## [1.4.2] - 2026-10-14

### Modifié
- Démo de Ballmania en version 1.3.0 : bombe offerte au premier tir et geste d'apprentissage au niveau 1-1.

## [1.4.1] - 2026-10-14

### Modifié
- Démo de Ballmania mise à jour en version 1.2.1 : nouvel écran titre, univers spatial, musique générée par monde, effets renforcés.

## [1.4.0] - 2026-10-13

### Ajouté
- Projet **Ballmania** dans le carrousel, en français et en anglais : démo jouable (deux mondes sur six, 24 niveaux) hébergée sur `/demos/ballmania/`, ouverte dans un nouvel onglet et non indexée, comme celle de Catapulte Mania.
- Nouvelle illustration animée `marbles` : chaîne de billes en spirale vers le trou, un tir fait éclater un groupe de trois.

## [1.3.0] - 2026-10-10

### Corrigé
- Cache navigateur : le JavaScript et le CSS restaient 7 jours en cache, les visiteurs déjà venus ne voyaient pas les mises à jour. Ils sont maintenant revérifiés à chaque visite.

### Ajouté
- Projet **Skull Darts 71** dans le carrousel (plateforme web du club de fléchettes, https://skulldarts71.fr), en français et en anglais.
- Nouvelle illustration animée `darts` : cible de fléchettes et fléchette qui se plante dans le triple 20.

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
