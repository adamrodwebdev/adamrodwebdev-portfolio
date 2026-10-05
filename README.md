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

1. **Domaine** : remplacez `https://www.adamrodwebdev.com/` partout (index.html, robots.txt, sitemap.xml) par votre vrai domaine.
2. **Projets** : dans `js/data/projects.js`, complétez descriptions et liens de Catapulte Mania et Bastion. Pour une capture d'écran, ajoutez `image: 'assets/projets/bastion.webp'` et `imageAlt: '…'` (format WebP, 1520×800 conseillé).
3. **E-mail** : `contactEmail` dans `js/config.js`.
4. **Mentions légales** : complétez `mentions-legales.html` (obligatoire en France : SIRET, hébergeur…).

## Formulaire de contact

- **Netlify (par défaut)** : déployez sur Netlify, le formulaire est détecté automatiquement (attribut `data-netlify`). Les messages arrivent dans le tableau de bord Netlify et peuvent être transférés par e-mail.
- **Autre hébergeur** : passez `formMode` à `'endpoint'` et renseignez `formEndpoint` (Formspree, Web3Forms, votre API).
- **Démo** : `formMode: 'demo'` joue l'animation sans rien envoyer.

## Ajouter un projet au carrousel

Copiez un objet dans `js/data/projects.js` :

```js
{ id: 'mon-projet', title: 'Mon projet', status: 'live', description: '…',
  tags: ['Vue 3'], url: 'https://…', art: 'classified' }
```

Le carrousel, les puces et le compteur s'adaptent automatiquement.

## Lighthouse (objectif ≥ 95 partout)

Le site est construit pour : contenu dans le HTML, JS en îlots, effets lancés après le chargement, polices non bloquantes, aucune image lourde, contrastes AA vérifiés, navigation clavier, `prefers-reduced-motion`, métadonnées, JSON-LD, sitemap.
Testez sur la version **déployée** (HTTPS) en navigation privée : Chrome DevTools → Lighthouse, ou https://pagespeed.web.dev.
Pour gagner encore quelques points en performance : héberger les polices localement (fichiers WOFF2 dans `assets/fonts`) et copier `vue.esm-browser.prod.js` dans `js/vendor/` en adaptant l'import map.

## Bande-son

« Ascension » est une composition originale, synthétisée en direct (ré mineur, 84 BPM) : nappes analogiques, arpège à délai pointé, basse en sidechain, percussions cinématiques et mélodie de cloche FM. Elle ne démarre qu'au clic (règles des navigateurs) et ne pèse rien au chargement : le moteur n'est téléchargé qu'à la première écoute.
