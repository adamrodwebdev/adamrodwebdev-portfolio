# AdamRodWebDev — portfolio

Site vitrine statique : HTML, CSS, JavaScript et **Vue 3** (dernière version stable de la branche 3.x, chargée en module ES via jsDelivr). Aucune compilation, aucun `npm install` : le dossier se déploie tel quel.

## Lancer en local

Les modules ES exigent un serveur (l'ouverture directe du fichier ne fonctionne pas) :

```bash
python3 -m http.server 8080      # puis http://localhost:8080
# ou : npx serve .
```

## Structure

```
index.html              Page principale (contenu statique pour le SEO + îlots Vue)
css/style.css           Styles, jetons de couleur, thèmes, animations
js/main.js              Monte les composants Vue et lance les effets
js/config.js            Mode d'envoi du formulaire, e-mail de contact
js/components/          NavBar, ProjectSwiper, ContactForm, MusicPlayer
js/composables/         useTheme (mode sombre + View Transitions)
js/data/projects.js     ← ajoutez vos projets ici
js/data/art.js          Illustrations SVG animées des projets
js/fx/                  Effets (révélations, curseur, éclats, particules)
js/audio/ascension.js   Bande-son originale synthétisée (Web Audio API)
assets/                 Favicons, icônes PWA, image Open Graph
404.html, merci.html, mentions-legales.html
robots.txt, sitemap.xml, manifest.webmanifest, netlify.toml
```

## À personnaliser avant la mise en ligne

1. **Domaine** : `https://adamrodwebdev.com` (constante `ORIGIN` dans `scripts/build-pages.mjs`, plus robots.txt et sitemap.xml).
2. **Projets** : dans `js/data/projects.js`, complétez descriptions et liens de Catapulte Mania et Bastion. Pour une capture d'écran, ajoutez `image: 'assets/projets/bastion.webp'` et `imageAlt: '…'` (format WebP, 1520×800 conseillé).
3. **E-mail** : `contactEmail` dans `js/config.js`.
4. **Mentions légales** : complétez `mentions-legales.html` (obligatoire en France : SIRET, hébergeur…).

## Formulaire de contact

- **Netlify (par défaut)** : déployez sur Netlify, le formulaire est détecté automatiquement (attribut `data-netlify`). Les messages arrivent dans le tableau de bord Netlify et peuvent être transférés par e-mail.
- **Autre hébergeur** : passez `formMode` à `'endpoint'` et renseignez `formEndpoint` (Formspree, Web3Forms, votre API).
- **Démo** : `formMode: 'demo'` joue l'animation sans rien envoyer.

## Démo de Catapulte Mania

`demos/catapulte-mania/index.html` est la démo autonome du jeu (8 niveaux, sans verrou), générée dans le dépôt du jeu avec `npm run build:demo`.
Pour la mettre à jour : reconstruisez la démo, remplacez ce fichier, puis poussez.

Correctif appliqué à la version 4.1.1 : Vite avait laissé le texte `__VITE_PRELOAD__` dans le code (le jeu restait bloqué sur « Chargement… »). Il a été remplacé par `void 0` et l'empreinte `sha256` de la Content-Security-Policy recalculée. À corriger à la source dans `vite.config.js` du jeu.

## Traductions (français / anglais)

Le site existe en français (`/`) et en anglais (`/en/`). Tous les textes sont dans **`js/i18n/messages.js`**.

- Les composants Vue les affichent avec **vue-i18n** (`t('cle')`), chargé depuis jsDelivr via l'import map.
- Les pages statiques `index.html` et `en/index.html` sont **générées** à partir de `templates/index.html` :
  ```bash
  node scripts/build-pages.mjs
  ```
  Netlify lance cette commande à chaque déploiement. Ne modifiez pas `index.html` ou `en/index.html` à la main : modifiez le template ou les traductions.
- Syntaxe vue-i18n : `{ } @ $ |` sont des caractères spéciaux dans les messages (écrire `{'@'}` pour un @).

Ajouter une langue : un bloc dans `messages.js`, une entrée dans `SUPPORTED` et dans `pages` (script de génération).

## Ajouter un projet au carrousel

1. Ajoutez un objet dans `js/data/projects.js` :
   ```js
   { id: 'mon-projet', status: 'live', url: 'https://…', art: 'classified' }
   ```
2. Ajoutez ses textes dans `js/i18n/messages.js`, en français **et** en anglais :
   ```js
   'mon-projet': { title: 'Mon projet', description: '…', tags: ['Vue 3'], link: 'Voir le projet' },
   ```

Le carrousel, les puces et le compteur s'adaptent automatiquement.

## Lighthouse (objectif ≥ 95 partout)

Le site est construit pour : contenu dans le HTML, JS en îlots, effets lancés après le chargement, polices non bloquantes, aucune image lourde, contrastes AA vérifiés, navigation clavier, `prefers-reduced-motion`, métadonnées, JSON-LD, sitemap.
Testez sur la version **déployée** (HTTPS) en navigation privée : Chrome DevTools → Lighthouse, ou https://pagespeed.web.dev.
Pour gagner encore quelques points en performance : héberger les polices localement (fichiers WOFF2 dans `assets/fonts`) et copier `vue.esm-browser.prod.js` dans `js/vendor/` en adaptant l'import map.

## Bande-son

« Ascension » est une composition originale, synthétisée en direct (ré mineur, 84 BPM) : nappes analogiques, arpège à délai pointé, basse en sidechain, percussions cinématiques et mélodie de cloche FM. Elle ne démarre qu'au clic (règles des navigateurs) et ne pèse rien au chargement : le moteur n'est téléchargé qu'à la première écoute.
