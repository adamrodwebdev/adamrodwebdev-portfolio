# AdamRodWebDev — portfolio

Site vitrine statique : HTML, CSS, JavaScript et îlots **Vue 3** (Vue 3.5.44 et vue-i18n 11.4.16, versions figées, servis par le site). Une génération sans outil de bundle écrit le site publié dans `dist/` : rien n'est demandé à un autre domaine, et une politique de sécurité de contenu (CSP) stricte protège chaque page.

## Lancer en local

Node 22 ou plus. Les dépendances (Vue, vue-i18n et leur compilateur de gabarits, Playwright pour les tests) s'installent une fois :

```bash
npm ci
```

Puis, après chaque modification d'un gabarit, d'une traduction, d'un composant ou de la feuille de style :

```bash
npm run build
```

```bash
npm run serve
```

`npm run build` écrit le site dans `dist/` (ignoré par Git, Netlify le régénère à chaque déploiement). `npm run serve` le sert sur http://localhost:8080 avec les en-têtes de Netlify, CSP comprise, et la compression : ce qui marche là marche en ligne.

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
templates/              Gabarits des pages générées (accueil des cinq langues, page de Lumirift)
css/style.css           Styles, jetons de couleur, thèmes, animations (copiés dans les pages générées)
css/fonts.css           Polices du site (@font-face), fichiers WOFF2 dans fonts/
js/main.js              Lance les effets, puis importe les îlots Vue
js/islands.js           Monte les composants Vue, chacun dans sa propre tâche
js/config.js            Mode d'envoi du formulaire, e-mail de contact
js/i18n/languages.js    Les cinq langues : code, nom, adresses, langue de l'heure
js/i18n/locales/        Textes de l'accueil, un fichier par langue (fr, en, ru, it, es)
js/components/          NavBar, ProjectSwiper, ContactForm, MusicPlayer (gabarits précompilés dans dist/)
js/composables/         useTheme (mode sombre + View Transitions)
js/data/projects.js     ← ajoutez vos projets ici
js/data/platforms.js    Plateformes où jouer aux jeux (Playgama…)
js/data/art.js          Illustrations SVG animées des projets
js/fx/                  Effets (révélations, curseur, éclats, particules)
js/audio/ascension.js   Bande-son originale synthétisée (Web Audio API)
assets/                 Favicons, icônes PWA, image Open Graph
fonts/                  Rajdhani, Barlow, Unbounded (titre de Lumirift) : WOFF2, sous-ensemble latin
lumirift/               Médias de la page du jeu Lumirift
404.html, merci.html, mentions-legales.html, en/, ru/, it/, es/ (pages écrites à la main)
robots.txt, sitemap.xml, manifest.webmanifest

scripts/build.mjs       La génération : enchaîne les étapes ci-dessous et écrit dist/
scripts/site-files.mjs  Liste des fichiers publiés (rien d'autre du dépôt n'est servi)
scripts/vendor.mjs      Vue et vue-i18n copiés de node_modules, version dans le nom
scripts/vue-templates.mjs  Gabarits des composants précompilés (aucun unsafe-eval)
scripts/build-pages.mjs Pages traduites et page de Lumirift (textes, feuille copiée, chargement différé)
scripts/css.mjs         Feuille minifiée, réduite aux règles d'une page sans îlot Vue
scripts/after-first-paint.mjs  Polices et îlots demandés une fois le premier affichage signalé
scripts/page-audit.mjs  Empreintes des scripts et styles en ligne, contrôle des domaines tiers
scripts/headers.mjs     En-têtes HTTP et CSP, écrits dans dist/_headers
scripts/serve.mjs       Serveur local de dist/ qui applique dist/_headers
tests/site.spec.mjs     Tests Playwright (domaines tiers, CSP, fichiers internes, formulaire, langues)
netlify.toml            Génération et redirections
```

## Sécurité (1.9.0)

- **Rien d'un autre domaine** : Vue, vue-i18n et les polices sont servis par le site. La génération refuse une page qui chargerait une ressource ailleurs (script, feuille, police, image, préconnexion, import), et les tests le vérifient dans un vrai navigateur. Les liens `<a href>` vers d'autres sites restent libres.
- **CSP stricte**, écrite par la génération dans `dist/_headers` (`scripts/headers.mjs`) avec les autres en-têtes : `default-src 'none'`, puis `'self'` ; chaque `<script>` et `<style>` en ligne est autorisé par son empreinte SHA-256, recalculée à chaque génération. Ni `unsafe-inline` ni `unsafe-eval`.
- Conséquences pour écrire le site :
  - **pas d'attribut `style="…"`** dans le HTML ni dans le balisage inséré par `v-html` ou `innerHTML` (la CSP le bloque) : une classe ou une règle CSS à la place. Les liaisons `:style` de Vue et `element.style` restent permises ;
  - **pas de gestionnaire `onclick="…"`** : `addEventListener` ou `@click` ;
  - **pas de gabarit compilé dans le navigateur** : les composants gardent leur `template`, précompilé par la génération ; un gabarit ne contient ni `${…}` ni `\`.

  La génération s'arrête si l'une de ces règles est enfreinte.
- **Fichiers internes jamais servis** : Netlify publie `dist/`, où `scripts/site-files.mjs` ne copie que les fichiers du site.

## Tests

```bash
npm test
```

Génère `dist/`, le sert sur le port 8090, puis Playwright (un seul processus, Chromium, téléphone 390 × 844 et ordinateur 1280 × 800) vérifie : chaque page sans requête vers un autre domaine, sans violation de CSP ni erreur ; les en-têtes de sécurité ; les fichiers internes en 404 ; le formulaire, avec et sans JavaScript.

## À personnaliser avant la mise en ligne

1. **Domaine** : `https://adamrodwebdev.com` (constante `ORIGIN` dans `scripts/build-pages.mjs`, plus robots.txt et sitemap.xml).
2. **Projets** : dans `js/data/projects.js`, complétez descriptions et liens de Catapulte Mania et Bastion. Pour une capture d'écran, ajoutez `image: 'assets/projets/bastion.webp'` et `imageAlt: '…'` (format WebP, 1520×800 conseillé).
3. **E-mail** : `contactEmail` dans `js/config.js`.
4. **Mentions légales** : complétez `mentions-legales.html` (obligatoire en France : SIRET, hébergeur…).

## Formulaire de contact

- **Netlify (par défaut)** : déployez sur Netlify, le formulaire est détecté automatiquement (attribut `data-netlify`). Les messages arrivent dans le tableau de bord Netlify et peuvent être transférés par e-mail.
- **Autre hébergeur** : passez `formMode` à `'endpoint'` et renseignez `formEndpoint` (Formspree, Web3Forms, votre API).
- **Démo** : `formMode: 'demo'` joue l'animation sans rien envoyer.

Les deux versions du formulaire (Vue et sans JavaScript) envoient les mêmes champs, dont la case de consentement (`rgpd=oui`) et le pot de miel (`bot-field`, vide pour un humain). La version 1.10 les enverra à l'API de l'espace client.

**Durée de conservation** (mentions légales) : 12 mois après le dernier échange. Netlify et Zoho gardent les messages jusqu'à leur suppression : effacez à la main les envois de plus de 12 mois dans Netlify (**Forms → contact**) et dans la boîte contact@adamrodwebdev.com.

## Jeux du carrousel

Les fiches des jeux mènent à leur page de jeu sur les plateformes (Playgama pour l'instant), plus à des démos hébergées ici (retirées en 1.9.0). Dans `js/data/projects.js`, le champ `play` donne une adresse par plateforme, dans l'ordre d'affichage :

```js
{ id: 'catapulte-mania', status: 'live', play: { playgama: 'https://playgama.ai/play/…' }, art: 'catapult' },
```

Une nouvelle plateforme s'ajoute dans `js/data/platforms.js` (son nom) ; le libellé « Jouer sur … » est traduit (`swiper.playOn`). Ballmania est « À venir » tant qu'il n'a pas de page Playgama.

Les anciennes adresses des démos redirigent (`netlify.toml`) : Catapulte Mania vers Playgama, Ballmania vers l'accueil, Lumirift (et Stackrift) vers `/lumirift/`.

## Page de Lumirift (`/lumirift/`)

La page du jeu, en anglais, est l'adresse que donnent les réseaux sociaux (adamrodwebdev.com/lumirift). Elle est **générée** comme l'accueil : gabarit `templates/lumirift.html`, textes dans `js/i18n/messages.js` (export `lumiriftPage`, hors de vue-i18n), réglages (lien Playgama, profils, clip) dans `scripts/build-pages.mjs`. Elle n'a pas d'îlot Vue : un petit script en bas de page gère le bouton de thème et le clip. De `css/style.css`, elle ne garde que les règles que son HTML applique (6 Ko au lieu de 41) ; si son script ajoute une classe à un élément, déclarez-la dans `runtimeClasses` pour que ses règles restent.

Ses médias sont dans `lumirift/` :
- `clip.mp4` : le clip du lundi de la fabrique de clips du jeu (`npm run clips` dans le dépôt de Lumirift), réduit à 720 × 1280, sans son, moins de 2 Mo ; `clip-poster-*` son image à 0,47 s (AVIF, WebP, JPEG pour les données structurées) ;
- `card-*` : les images des trois cartes, recadrées en 4:3 (480 et 800 px) ; `avatar-176` ; `og-lumirift-1200x630.png`, la carte de partage.

Le clip ne se charge qu'après la page et un moment de calme, jamais avec `prefers-reduced-motion` ni l'économie de données. Le titre utilise Unbounded, réduite aux lettres du titre (`fonts/unbounded-900-title.woff2`, 1,5 Ko) : si le titre change de lettres, refaites ce fichier.

## Traductions (cinq langues, 1.10.0)

Le site existe en français (`/`), en anglais (`/en/`), en russe (`/ru/`), en italien (`/it/`) et en espagnol (`/es/`). Un menu dans l'en-tête (un `<details>`, utilisable sans JavaScript) mène de l'une à l'autre en gardant la section affichée ; le pied de page liste aussi les autres langues.

- **Textes** : un fichier par langue dans **`js/i18n/locales/`** (`fr.js` fait référence). Toutes les langues ont exactement les mêmes clés, les mêmes longueurs de listes et les mêmes paramètres (`{title}`…) : un test le vérifie.
- **Langues et adresses** : `js/i18n/languages.js` (code, nom affiché, accueil, page de confirmation, mentions légales, langue de l'heure). La génération, le menu et l'horloge s'en servent.
- **Chaque page ne charge que sa langue** : `js/i18n/index.js` importe `locales/<code>.js`, que la génération précharge avec les îlots Vue. `js/i18n/messages.js` réunit toutes les langues pour la génération et les tests ; le navigateur ne le demande pas.
- Les accueils de `dist/` sont **générés** à partir de `templates/index.html` par `npm run build`, avec les liens `hreflang` des cinq langues et `x-default` vers le français.
- Les pages 404 et de confirmation existent dans chaque langue (`ru/404.html`, `ru/thank-you.html`…). Les mentions légales n'existent qu'en français (version légale) et en anglais : les autres langues mènent à l'anglaise, et le lien le dit.
- **Russe** : Rajdhani et Barlow n'ont pas de cyrillique ; la page russe utilise des polices système qui en ont (`:root:lang(ru)` dans `css/style.css`).
- Syntaxe vue-i18n : `{ } @ $ |` sont des caractères spéciaux dans les messages (écrire `{'@'}` pour un @) ; le test le contrôle.
- Registre : *vous* en français, *you* en anglais, *вы* en russe, *tu* en italien, *tú* en espagnol (Espagne). Les textes italiens et espagnols méritent une relecture par une personne de langue maternelle avant d'être mis en avant.

Ajouter une langue : une entrée dans `js/i18n/languages.js`, le fichier `js/i18n/locales/<code>.js` (mêmes clés que `fr.js`) et son import dans `messages.js`, un dossier `<code>/` avec `404.html` et `thank-you.html`, puis `scripts/site-files.mjs`, la règle 404 de `netlify.toml` et `sitemap.xml`.

## Ajouter un projet au carrousel

1. Ajoutez un objet dans `js/data/projects.js` :
   ```js
   { id: 'mon-projet', status: 'live', url: 'https://…', art: 'classified' }
   ```
   Pour un jeu, `play: { playgama: 'https://…' }` au lieu de `url` (voir « Jeux du carrousel »).
2. Ajoutez ses textes sous `projects` dans **chacun** des cinq fichiers de `js/i18n/locales/` (le test des traductions échoue s'il en manque un) :
   ```js
   'mon-projet': { title: 'Mon projet', description: '…', tags: ['Vue 3'], link: 'Voir le projet' },
   ```

Le carrousel, les puces et le compteur s'adaptent automatiquement.

## Profondeur (1.11.0)

La page se lit comme une pile de plaques, en CSS seulement (`css/style.css`, bloc « Profondeur ») :

- **Panneaux** : Services, Projets, Méthode et Contact sont des panneaux (`.panel`) qui glissent sur la section d'avant. Chacun la recouvre de `--overlap`, toujours dans sa marge du bas, jamais sur son contenu ; son bord haut fait une marche en biais (`.panel--rise` ou `.panel--fall`), liseré d'or. Le hero passe sous le premier panneau quand on défile.
- **Plaques** : les cartes des services, les étapes de la méthode et le formulaire reposent sur une plaque décalée de `--plate` ; au survol, une carte se détache de la sienne.
- **Trois plans en défilant** : au fond, le grand numéro du panneau (`.panel__index`, 01 à 04) va moins vite que la page ; devant, deux éclats (`.panel__shard`) vont plus vite ; les plaques traînent un peu. Animations liées au défilement (`animation-timeline`), `transform` seulement, sur le processeur graphique. Immobiles si le visiteur a réduit les animations, ou si son navigateur ne les connaît pas (Firefox à ce jour) : la profondeur reste, sans le mouvement.

Ajouter un panneau : la classe `panel panel--rise` (ou `--fall`, en alternance), son `z-index` au-dessus du précédent, ses trois décors (`panel__index` avec `data-index`, deux `panel__shard`).

## Lighthouse (objectif : 100 partout)

Mesuré sur mobile (trois passages après un passage de préchauffage, le pire comptant) et sur ordinateur, à chaque version. Ce qui le tient :

- **Rien ne retient le premier affichage** : chaque page générée porte sa feuille de style (`scripts/css.mjs`).
- **Le reste vient après** : polices, Vue, vue-i18n et îlots ne sont demandés qu'une fois le premier affichage signalé (`scripts/after-first-paint.mjs`). Lighthouse simule un téléphone lent à partir de ce qui est arrivé avant ce premier affichage : une requête partie plus tôt, même sans rien bloquer, allonge la durée simulée.
- **Le plus grand élément du premier écran est visible dès la première image** (le paragraphe du hero ; l'affiche du clip sur `/lumirift/`) : jamais de fondu d'entrée sur lui, sinon Chrome peut le compter tard.
- **Aucune longue tâche** : les îlots Vue se montent chacun dans sa propre tâche, les effets décoratifs après le chargement, et aucune mesure de mise en page pendant un montage.
- Contenu dans le HTML, aucune image lourde, contrastes AA vérifiés, navigation clavier, `prefers-reduced-motion`, métadonnées, JSON-LD, sitemap.

- **Tout vient du site** (1.9.0) : plus de connexion à ouvrir vers Google Fonts ou jsDelivr, et la version d'exécution seule de Vue (113 Ko au lieu de 175, avant compression).

En local, sur `npm run serve` (mêmes en-têtes et même compression que Netlify), ou sur la version **déployée** (HTTPS) en navigation privée : Chrome DevTools → Lighthouse, ou https://pagespeed.web.dev. La note varie d'un passage à l'autre avec le réseau et la charge de la machine.

## Bande-son

« Ascension » est une composition originale, synthétisée en direct (ré mineur, 84 BPM) : nappes analogiques, arpège à délai pointé, basse en sidechain, percussions cinématiques et mélodie de cloche FM. Elle ne démarre qu'au clic (règles des navigateurs) et ne pèse rien au chargement : le moteur n'est téléchargé qu'à la première écoute.
