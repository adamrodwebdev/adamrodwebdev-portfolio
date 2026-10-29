# AdamRodWebDev — portfolio

Site vitrine statique : HTML, CSS, JavaScript et **Vue 3** (dernière version stable de la branche 3.x, chargée en module ES via jsDelivr). Aucune compilation, aucun `npm install` : le dossier se déploie tel quel.

## Lancer en local

Les modules ES exigent un serveur (l'ouverture directe du fichier ne fonctionne pas) :

```bash
python3 -m http.server 8080      # puis http://localhost:8080
# ou : npx serve .
```

`index.html`, `en/index.html` et `lumirift/index.html` sont **générées**, et la feuille `css/style.css` y est copiée : après avoir modifié un gabarit, une traduction ou la feuille de style, régénérez-les avant de regarder le résultat (Netlify le fait à chaque déploiement) :

```bash
node scripts/build-pages.mjs
```

## Branches et mise en ligne

Netlify publie automatiquement chaque push sur `main`, et chaque mise en production coûte 15 crédits. Pour ne payer que les versions publiées :

- **`dev`** : branche de travail. On y committe et on y pousse librement : Netlify ne la construit pas (seule la branche de production est déployée).
- **`main`** : branche publiée. On n'y fusionne `dev` que pour mettre une version en ligne :

```bash
git switch main
git merge --ff-only dev
git push origin main      # déclenche un seul déploiement Netlify
git switch dev
```

Si les builds ont été arrêtés dans Netlify, les pushes reçus pendant l'arrêt ne sont pas rejoués : relancez la publication avec **Deploys → Trigger deploy → Deploy project**.

## Structure

```
index.html              Page principale, générée (contenu statique pour le SEO + îlots Vue)
css/style.css           Styles, jetons de couleur, thèmes, animations (copiés dans les pages générées)
js/main.js              Lance les effets, puis importe les îlots Vue
js/islands.js           Monte les composants Vue, chacun dans sa propre tâche
js/config.js            Mode d'envoi du formulaire, e-mail de contact
js/components/          NavBar, ProjectSwiper, ContactForm, MusicPlayer
js/composables/         useTheme (mode sombre + View Transitions)
js/data/projects.js     ← ajoutez vos projets ici
js/data/art.js          Illustrations SVG animées des projets
js/fx/                  Effets (révélations, curseur, éclats, particules)
js/audio/ascension.js   Bande-son originale synthétisée (Web Audio API)
assets/                 Favicons, icônes PWA, image Open Graph
templates/              Gabarits des pages générées (accueil, page de Lumirift)
scripts/build-pages.mjs Génération des pages (textes, feuille de style copiée, chargement différé)
scripts/css.mjs         Feuille minifiée, réduite aux règles d'une page sans îlot Vue
scripts/after-first-paint.mjs  Polices et îlots demandés une fois le premier affichage signalé
lumirift/               Page du jeu Lumirift (générée) et ses médias
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

## Démo de Ballmania

`demos/ballmania/` est la démo du jeu (deux mondes sur six, sans publicité), construite dans le dépôt du jeu avec `npm run build:demo`, qui produit `dist-demo/`.
Pour la mettre à jour : reconstruisez la démo, remplacez le contenu de `demos/ballmania/` par celui de `dist-demo/` (sans `robots.txt`), puis poussez. Les chemins sont relatifs : aucun réglage n'est nécessaire pour le sous-dossier.

## Démo de Lumirift

`demos/lumirift/` est la démo du jeu, anciennement Stackrift (`/demos/stackrift/` redirige) : cinq modes sur treize et le premier chapitre de la campagne, construite dans le dépôt du jeu avec `npm run build:demo`, qui produit `dist-demo/`.
Pour la mettre à jour : reconstruisez la démo, remplacez le contenu de `demos/lumirift/` par `index.html`, `favicon.svg` et `assets/` de `dist-demo/`, puis poussez. Les chemins sont relatifs : aucun réglage n'est nécessaire pour le sous-dossier.

## Page de Lumirift (`/lumirift/`)

La page du jeu, en anglais, est l'adresse que donnent les réseaux sociaux (adamrodwebdev.com/lumirift). Elle est **générée** comme l'accueil : gabarit `templates/lumirift.html`, textes dans `js/i18n/messages.js` (export `lumiriftPage`, hors de vue-i18n), réglages (lien Playgama, profils, clip) dans `scripts/build-pages.mjs`. Elle n'a pas d'îlot Vue : un petit script en bas de page gère le bouton de thème et le clip. De `css/style.css`, elle ne garde que les règles que son HTML applique (6 Ko au lieu de 41) ; si son script ajoute une classe à un élément, déclarez-la dans `runtimeClasses` pour que ses règles restent.

Ses médias sont dans `lumirift/` :
- `clip.mp4` : le clip du lundi de la fabrique de clips du jeu (`npm run clips` dans le dépôt de Lumirift), réduit à 720 × 1280, sans son, moins de 2 Mo ; `clip-poster-*` son image à 0,47 s (AVIF, WebP, JPEG pour les données structurées) ;
- `card-*` : les images des trois cartes, recadrées en 4:3 (480 et 800 px) ; `avatar-176` ; `og-lumirift-1200x630.png`, la carte de partage.

Le clip ne se charge qu'après la page et un moment de calme, jamais avec `prefers-reduced-motion` ni l'économie de données. La page ne mène jamais à la démo, dont les parties ne comptent pas sur Playgama.

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

## Lighthouse (objectif : 100 partout)

Mesuré sur mobile (trois passages après un passage de préchauffage, le pire comptant) et sur ordinateur, à chaque version. Ce qui le tient :

- **Rien ne retient le premier affichage** : chaque page générée porte sa feuille de style (`scripts/css.mjs`).
- **Le reste vient après** : polices, Vue, vue-i18n et îlots ne sont demandés qu'une fois le premier affichage signalé (`scripts/after-first-paint.mjs`). Lighthouse simule un téléphone lent à partir de ce qui est arrivé avant ce premier affichage : une requête partie plus tôt, même sans rien bloquer, allonge la durée simulée.
- **Le plus grand élément du premier écran est visible dès la première image** (le paragraphe du hero ; l'affiche du clip sur `/lumirift/`) : jamais de fondu d'entrée sur lui, sinon Chrome peut le compter tard.
- **Aucune longue tâche** : les îlots Vue se montent chacun dans sa propre tâche, les effets décoratifs après le chargement, et aucune mesure de mise en page pendant un montage.
- Contenu dans le HTML, aucune image lourde, contrastes AA vérifiés, navigation clavier, `prefers-reduced-motion`, métadonnées, JSON-LD, sitemap.

Testez sur la version **déployée** (HTTPS) en navigation privée : Chrome DevTools → Lighthouse, ou https://pagespeed.web.dev. La note varie d'un passage à l'autre avec le réseau du moment.
Pistes : héberger les polices sur le site (fichiers WOFF2, plus aucune requête vers Google) et copier `vue.esm-browser.prod.js` dans `js/vendor/` en adaptant l'import map (une version figée, plus de dépendance au CDN).

## Bande-son

« Ascension » est une composition originale, synthétisée en direct (ré mineur, 84 BPM) : nappes analogiques, arpège à délai pointé, basse en sidechain, percussions cinématiques et mélodie de cloche FM. Elle ne démarre qu'au clic (règles des navigateurs) et ne pèse rien au chargement : le moteur n'est téléchargé qu'à la première écoute.
