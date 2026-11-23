# AdamRodWebTech — portfolio (adamrodwebdev.com)

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
templates/ressac/       Licence des polices Ressac : gabarit et copies exactes du texte de la fonderie
css/style.css           Styles, jetons de couleur, thèmes, animations (copiés dans les pages générées)
css/fonts.css           Polices du site (@font-face), fichiers WOFF2 dans fonts/
js/main.js              Lance les effets, puis importe les îlots Vue
js/islands.js           Monte les composants Vue, chacun dans sa propre tâche, les carrousels à l'approche de leur section
js/config.js            Mode d'envoi du formulaire, e-mail de contact, liens d'agenda et de profil Malt
js/i18n/languages.js    Les cinq langues : code, nom, adresses, langue de l'heure
js/i18n/locales/        Textes de l'accueil, un fichier par langue (fr, en, ru, it, es)
js/components/          NavBar, ProjectSwiper, SoundtrackPlayer, ContactForm (gabarits précompilés dans dist/)
js/composables/         useTheme (mode sombre + View Transitions)
js/data/projects.js     ← ajoutez vos projets ici (groupe « work » ou « lab » : réalisations ou créations)
js/data/offers.js       Les offres : prix des formules, de la maintenance et du pré-audit, types de projet
js/data/testimonials.js Les témoignages de clients (vide tant qu'il n'y a pas de vrai avis)
js/data/platforms.js    Plateformes où jouer aux jeux (Playgama…)
js/data/art.js          Illustrations SVG animées des projets
js/fx/                  Effets (révélations, curseur, éclats, particules)
js/audio/score.js       « Sfumato » : la partition (grille, mélodie, parties), sans son
js/audio/sfumato.js     Le moteur : mixage, effets, lecture ; chargé à la première écoute
js/audio/instruments.js Les pupitres synthétisés (cordes, cuivres, timbales, chœur, voix, synthés)
js/audio/arrangement.js Qui joue quoi, double croche par double croche
js/audio/soundtrack.js  L'état partagé par l'interrupteur de l'en-tête et le lecteur
assets/                 Favicons, icônes PWA, image Open Graph
fonts/                  Clivage (la police signature, exclusive : latin et cyrillique), Barlow, Unbounded (titre de Lumirift) : WOFF2
lumirift/               Médias de la page du jeu Lumirift
404.html, merci.html, mentions-legales.html, en/, ru/, it/, es/ (pages écrites à la main)
robots.txt, sitemap.xml, manifest.webmanifest

scripts/build.mjs       La génération : enchaîne les étapes ci-dessous et écrit dist/
scripts/site-files.mjs  Liste des fichiers publiés (rien d'autre du dépôt n'est servi)
scripts/vendor.mjs      Vue et vue-i18n copiés de node_modules, version dans le nom
scripts/vue-templates.mjs  Gabarits des composants précompilés (aucun unsafe-eval)
scripts/build-pages.mjs Pages traduites et page de Lumirift (textes, feuille copiée, chargement différé)
scripts/css.mjs         Feuille minifiée, réduite aux règles d'une page sans îlot Vue
scripts/after-first-paint.mjs  Polices et îlots demandés une fois le premier affichage signalé ; sur l'accueil, polices données bloc par bloc
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

Lance d'abord les tests unitaires (`npm run test:unit`, node:test : prix dans chaque langue, liens sortants et leurs entrées hostiles, témoignages échappés, données structurées), puis génère `dist/`, le sert sur le port 8090, et Playwright (un seul processus, Chromium, téléphone 390 × 844 et ordinateur 1280 × 800) vérifie : chaque page sans requête vers un autre domaine, sans violation de CSP ni erreur ; les en-têtes de sécurité ; les fichiers internes en 404 ; le formulaire, avec et sans JavaScript.

### Un plantage du navigateur de test, pas du site (17 novembre 2026)

Le projet `desktop` tourne dans le *headless shell* de Chromium, le navigateur sans écran allégé que Playwright lance par défaut. Ce navigateur plante parfois, sur une vérification interne de son compositeur (« Target crashed », `EXCEPTION_BREAKPOINT`, suivi d'erreurs `SharedImageManager::ProduceMemory`), dans un cas précis : **une vraie souris qui bouge pendant que la page défile en douceur, quand les carrousels sont en 3D** (le mode ordinateur).

- Mesuré avec la même sonde : 7 plantages sur 12 dans le headless shell ; **aucun dans Chrome stable (30 sur 30) ni dans WebKit (10 sur 10)**. Les visiteurs ne sont pas touchés.
- Sans les carrousels, plus aucun plantage (20 sur 20). Retirer seulement leur filtre gris, leur `preserve-3d`, leur réponse au pointeur, le curseur personnalisé, le défilement en douceur ou les flous d'arrière-plan réduit le risque sans le supprimer : une course du compositeur, plus probable avec plus de calques 3D.
- **Pour écrire un test** : quand un clic fait défiler la page (une ancre, un bouton qui mène au formulaire), cliquez sans souris, avec `locator.dispatchEvent('click')`, ou faites défiler instantanément ; ne bougez pas la souris pendant le défilement.

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

Une nouvelle plateforme s'ajoute dans `js/data/platforms.js` (son nom) ; le libellé « Jouer sur … » est traduit (`swiper.playOn`). Ballmania est « À venir » tant qu'il n'a pas de page Playgama. Cocorico est « En développement », sans lien : l'application est privée et tourne sur le PC de la maison, sans serveur.

Les anciennes adresses des démos redirigent (`netlify.toml`) : Catapulte Mania vers Playgama, Ballmania vers l'accueil, Lumirift (et Stackrift) vers `/lumirift/`.

## Page de Lumirift (`/lumirift/`)

La page du jeu, en anglais, est l'adresse que donnent les réseaux sociaux (adamrodwebdev.com/lumirift). Elle est **générée** comme l'accueil : gabarit `templates/lumirift.html`, textes dans `js/i18n/messages.js` (export `lumiriftPage`, hors de vue-i18n), réglages (lien Playgama, profils, clip) dans `scripts/build-pages.mjs`. Elle n'a pas d'îlot Vue : un petit script en bas de page gère le bouton de thème et le clip. De `css/style.css`, elle ne garde que les règles que son HTML applique (6 Ko au lieu de 41) ; si son script ajoute une classe à un élément, déclarez-la dans `runtimeClasses` pour que ses règles restent.

Ses médias sont dans `lumirift/` :
- `clip.mp4` : le clip du lundi de la fabrique de clips du jeu (`npm run clips` dans le dépôt de Lumirift), réduit à 720 × 1280, sans son, moins de 2 Mo ; `clip-poster-*` son image à 0,47 s (AVIF, WebP, JPEG pour les données structurées) ;
- `card-*` : les images des trois cartes, recadrées en 4:3 (480 et 800 px) ; `avatar-176` ; `og-lumirift-1200x630.png`, la carte de partage.

Le clip ne se charge qu'après la page et un moment de calme, jamais avec `prefers-reduced-motion` ni l'économie de données. Le titre utilise Unbounded, réduite aux lettres du titre (`fonts/unbounded-900-title.woff2`, 1,5 Ko) : si le titre change de lettres, refaites ce fichier.

## La licence des polices Ressac (1.18.0)

La licence (CLUF, EULA) des polices de la fonderie Ressac, vendues sur Gumroad : la case « Conditions » du paiement y renvoie, car la licence est le contrat entre le vendeur et l'acheteur (conditions de Gumroad, 6.7).

- **Deux pages** : `/ressac/licence/` en français, qui prévaut, et `/en/ressac/licence/` en anglais. Chacune le dit et mène à l'autre. Il n'y a pas de licence en russe, en italien ni en espagnol (un texte juridique ne se traduit pas sans relecture) : pour ces langues, les moteurs de recherche reçoivent l'anglaise (`x-default`).
- **Le texte vient de la fonderie, mot pour mot.** `templates/ressac/EULA.fr.md` et `EULA.en.md` sont des copies exactes de `licence/EULA.fr.md` et `licence/EULA.en.md` du dépôt `type-foundry` (privé), au commit noté dans `scripts/licence-pages.mjs` (`LICENCE_SOURCE`, avec l'identifiant Git de chaque fichier). La génération s'arrête si une copie a été retouchée ici : le texte se corrige dans la fonderie, jamais dans ce dépôt.
- **Générées** par `scripts/licence-pages.mjs` (gabarit `templates/ressac/licence.html`, textes autour de la licence dans `js/i18n/messages.js`, export `licencePage`). Le Markdown est lu par `scripts/licence-markdown.mjs`, qui ne connaît que ce que la licence emploie (titres, paragraphes, listes, tableaux, gras, code) et refuse tout le reste plutôt que de mal le rendre.
- **La typographie française** s'applique au rendu de la page française (`TYPOGRAPHY` dans `scripts/licence-markdown.mjs`) : espaces insécables avant ; : ! ? » et après «, dans les nombres, entre un nombre et son unité et dans les numéros de téléphone. Les mots ne changent pas : le test de fidélité compare le texte, espaces comprises comme des espaces.
- **Les ancres** : `#article-14` en français, `#section-14` en anglais, `#article-10-4` pour chaque interdit de l'article 10, `#annexe-a` et `#schedule-a` pour les prix. Le saut est immédiat (pas de défilement doux sur ces pages : il mettait plus d'une seconde à traverser le contrat).
- **Le texte du contrat se lit dans les polices du système**, comme le texte courant des pages russes ; les titres gardent la signature. Avec Barlow, le texte visible sur ordinateur se recomposait à l'arrivée de la police (décalage de 0,12, Lighthouse à 96) et une ancre ouverte de l'extérieur glissait de 300 px ; même un repli calé sur la chasse de Barlow laissait un mot changer de ligne. Sans police de texte à attendre, rien ne bouge.
- **Mettre la licence à jour**, à chaque nouvelle version du texte dans la fonderie :

  ```bash
  git -C ../type-foundry show <commit>:licence/EULA.fr.md > templates/ressac/EULA.fr.md
  git -C ../type-foundry show <commit>:licence/EULA.en.md > templates/ressac/EULA.en.md
  git -C ../type-foundry rev-parse <commit> <commit>:licence/EULA.fr.md <commit>:licence/EULA.en.md
  ```

  puis reportez le commit et les deux identifiants dans `LICENCE_SOURCE` et `LICENCE_PAGES`, et lancez `npm test`.
- **Le médiateur** : l'article 17 nomme CM2C, avec qui la convention est signée depuis le 18 novembre 2026 (valable jusqu'au 18 novembre 2029). On ne peut pas nommer un médiateur avant d'avoir signé sa convention (règle de la CECMC) : la licence n'est partie en ligne qu'après.

## La police signature (1.14.0)

**Clivage** est la police d'affichage du site : logo, hero, titres, menus, boutons, étiquettes, grands chiffres. Barlow reste celle du texte courant. Elle a été dessinée pour AdamRodWebTech et lui est **exclusive : jamais vendue, tous droits réservés** (`fonts/LICENCES.md`). Sa source, le code qui la dessine, vit dans le dépôt privé de la fonderie ; seul le fichier compilé est ici. Son nom dit les deux faces de la police : en minéralogie, le clivage est le plan selon lequel un cristal se fend net ; en français courant, la fracture qui divise une société.

- **Une police variable à un axe, `FRAC`** : 0 entière, 100 brisée (le verre se fend, le signal se perd, le mot se déchire en deux). La chasse ne change jamais sur l'axe : l'animer ne déplace rien.
- **Les animations** (`css/style.css`, `js/fx/effects.js`) : un titre arrive brisé et se répare en apparaissant (`data-repair`, classe `is-repairing`) ; le hero se brise puis se répare une fois la police chargée (`is-shattering`) ; le logo et les titres se fissurent au survol à la souris (`crack-once`) ; les pages 404 perdent leur signal (`lost-signal`). Rien avec « réduire les animations ». **Toujours par paliers** (`steps()`) : chaque état recalcule la mise en forme des lettres variables ; en continu, l'animation des grands titres chargeait le fil principal au chargement (Lighthouse tombait à 90 dès que la machine travaillait).
- **Jamais de `-webkit-text-stroke` sur la signature** : la lettre est faite d'éclats jointifs, un contour CSS tracerait leurs lignes de cassure. Pour un effet doré, remplir (`background-clip: text`) ; un test le vérifie.
- **Mêmes mesures que Rajdhani**, qu'elle remplace : hauteur de capitale, boîte de ligne et chasses identiques. Son repli calé (`Clivage Fallback` : Arial Bold à 76,7 %, déclaré dans `css/style.css`, donc copié dans chaque page) sert dès le premier affichage, et rien ne bouge quand elle arrive. Le russe a son propre repli (77,95 %), calculé sur ses titres, menus et boutons.
- **Latin** du français, de l'anglais, de l'espagnol et de l'italien, avec des chiffres tabulaires (`font-variant-numeric: tabular-nums`) pour l'horloge et les compteurs, et **cyrillique du russe** (1.15.0). Un caractère absent passe à la police suivante de la pile.
- **Deux fichiers** : `clivage-v2-latin.woff2` (30 Ko) et `clivage-v2-cyrillic.woff2` (20 Ko), découpés dans la même police variable et déclarés avec leur `unicode-range` : une page ne télécharge que les lettres qu'elle affiche (le russe prend les deux, pour ses chiffres, sa ponctuation et le logo). Le menu des langues fermé n'est pas mis en page (`display: none`) : sans quoi le « Русский » de ce menu ferait venir le cyrillique sur les pages latines, ce que fait le Chrome de Lighthouse avec un `<details>` fermé. Le cyrillique n'arrive qu'à l'ouverture du menu.
- **La remplacer** : refaire la police depuis la fonderie, la découper en deux (`fontTools.subset`, mêmes plages que dans `css/fonts.css`, toutes les fonctions OpenType gardées), compresser en WOFF2, déposer les fichiers sous un **nouveau nom** (`clivage-v3-…`, les polices sont mises en cache un an) et mettre à jour `css/fonts.css`.

## Sélection du texte (1.14.1)

Les **titres et l'interface** ne se sélectionnent pas (`user-select: none`, et `-webkit-touch-callout: none` contre le menu de l'appui long d'un téléphone) : une sélection couvrait le hero et les titres de pavés dorés. Les **textes, les coordonnées et les mentions légales** restent sélectionnables, pour copier une adresse, traduire, ou faire lire la sélection à voix haute (iOS et Android) ; leur sélection (`::selection`) est un voile doré qui garde la couleur du texte. La liste des éléments d'interface est en tête de `css/style.css` ; un nouvel élément d'interface s'y ajoute, un nouveau texte n'a rien à faire. Un test le vérifie.

## Traductions (cinq langues, 1.10.0)

Le site existe en français (`/`), en anglais (`/en/`), en russe (`/ru/`), en italien (`/it/`) et en espagnol (`/es/`). Un menu dans l'en-tête (un `<details>`, utilisable sans JavaScript) mène de l'une à l'autre en gardant la section affichée ; le pied de page liste aussi les autres langues.

- **Textes** : un fichier par langue dans **`js/i18n/locales/`** (`fr.js` fait référence). Toutes les langues ont exactement les mêmes clés, les mêmes longueurs de listes et les mêmes paramètres (`{title}`…) : un test le vérifie.
- **Langues et adresses** : `js/i18n/languages.js` (code, nom affiché, accueil, page de confirmation, mentions légales, langue de l'heure). La génération, le menu et l'horloge s'en servent.
- **Chaque page ne charge que sa langue** : `js/i18n/index.js` importe `locales/<code>.js`, que la génération précharge avec les îlots Vue. `js/i18n/messages.js` réunit toutes les langues pour la génération et les tests ; le navigateur ne le demande pas.
- Les accueils de `dist/` sont **générés** à partir de `templates/index.html` par `npm run build`, avec les liens `hreflang` des cinq langues et `x-default` vers le français.
- Les pages 404 et de confirmation existent dans chaque langue (`ru/404.html`, `ru/thank-you.html`…). Les mentions légales n'existent qu'en français (version légale) et en anglais : les autres langues mènent à l'anglaise, et le lien le dit. La section « Médiation de la consommation » (`#mediation`, 1.18.0) donne la clause de CM2C : en français telle que CM2C la fournit, en anglais, et dans la page anglaise en russe, en italien et en espagnol, puisque ces langues y mènent ; chaque version précise que la médiation se fait en français. Comme la licence, les mentions légales se lisent dans les polices du système (les titres gardent la signature) : sans Barlow à attendre, rien ne bouge à l'ouverture.
- **Russe** : la police signature parle russe (1.15.0) et garde tout l'affichage ; Barlow n'a pas de cyrillique, le texte courant russe prend des polices système qui en ont (`:root:lang(ru)` dans `css/style.css`). Les textes russes méritent la relecture d'un lecteur natif, la police aussi.
- Syntaxe vue-i18n : `{ } @ $ |` sont des caractères spéciaux dans les messages (écrire `{'@'}` pour un @) ; le test le contrôle.
- Registre : *vous* en français, *you* en anglais, *вы* en russe, *tu* en italien, *tú* en espagnol (Espagne). Les textes italiens et espagnols méritent une relecture par une personne de langue maternelle avant d'être mis en avant.

Ajouter une langue : une entrée dans `js/i18n/languages.js`, le fichier `js/i18n/locales/<code>.js` (mêmes clés que `fr.js`) et son import dans `messages.js`, un dossier `<code>/` avec `404.html` et `thank-you.html`, puis `scripts/site-files.mjs`, la règle 404 de `netlify.toml` et `sitemap.xml`.

## Ajouter un projet au carrousel

1. Ajoutez un objet dans `js/data/projects.js` :
   ```js
   { id: 'mon-projet', group: 'work', status: 'live', url: 'https://…', art: 'classified' }
   ```
   `group` choisit le carrousel : `'work'` pour les réalisations (sites et applications), `'lab'` pour les créations (jeux). Pour un jeu, `play: { playgama: 'https://…' }` au lieu de `url` (voir « Jeux du carrousel »).
2. Ajoutez ses textes sous `projects` dans **chacun** des cinq fichiers de `js/i18n/locales/` (le test des traductions échoue s'il en manque un) :
   ```js
   'mon-projet': { title: 'Mon projet', description: '…', tags: ['Vue 3'], link: 'Voir le projet' },
   ```

Le carrousel, les puces et le compteur s'adaptent automatiquement.

## Offre commerciale (1.17.0)

L'accueil s'ouvre sur les offres, avant les services ; les réalisations (sites et applications) et les créations (jeux) ont chacune leur carrousel. Tout ce bloc est rendu à la génération (`scripts/offers.mjs`) : il se lit sans JavaScript.

- **Les prix** sont dans `js/data/offers.js`, en euros entiers ; chaque langue les écrit à sa façon (« 1 200 € », « €1,200 », « 1200 € »). Les textes des offres sont sous `offers` dans chaque fichier de `js/i18n/locales/`. **Les descriptions de page (`meta.description`, `meta.ogDescription`) citent aussi le prix d'appel et celui de la maintenance : changez-les ensemble.**
- **Les boutons des offres** choisissent le type de projet du formulaire (`data-project-type`, lu dans la liste fermée `PROJECT_TYPES`, dans l'ordre de `form.types`).
- **Prendre rendez-vous et Malt** : renseignez `bookingUrl` (agenda Cal.com) et `maltUrl` (profil) dans `js/config.js`. Tant qu'ils sont vides, rien n'est généré : le second bouton du héros reste « Démarrer un projet ». Ce sont de simples liens qui s'ouvrent dans un nouvel onglet, aucun widget, rien chargé d'un autre domaine ; seules les adresses https de `cal.com` et `malt.fr` sont admises (la génération échoue sinon).
- **Témoignages** : ajoutez un avis dans `js/data/testimonials.js` (nom, rôle et citation dans les cinq langues) ; la section apparaît dès le premier. **Uniquement de vrais avis, donnés par écrit, avec l'accord de la personne : n'en inventez jamais.**
- **Marque** : le site s'affiche sous le nom commercial déclaré, AdamRodWebTech ; le domaine, l'e-mail et les comptes restent en « adamrodwebdev ».

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
- **Le plus grand élément du premier écran est visible dès la première image** (le paragraphe du hero ; l'affiche du clip sur `/lumirift/`) : jamais de fondu d'entrée sur lui, sinon Chrome peut le compter tard. Le titre du hero entre en se dévoilant (`slice-in`, un `clip-path`) : Chrome ne le compte qu'à la fin de cette entrée, vers 0,9 s. Il doit donc rester plus petit que le paragraphe dans chaque langue, sinon il devient le plus grand élément en retard. Depuis « WebTech », il est réglé 4 % plus petit (`--step-4`, 1.18.0) ; vérifiez la langue au paragraphe le plus court (l'espagnol) après tout changement du titre ou de l'accroche.
- **Aucune longue tâche** : les îlots Vue se montent chacun dans sa propre tâche, les deux carrousels à l'approche de leur section (1.18.1), les effets décoratifs après le chargement, et aucune mesure de mise en page pendant un montage.
- **Les polices de l'accueil, bloc par bloc** (1.18.1). À la première mise en page d'une police web, Chrome mesure chaque lettre à chaque taille : de 0,3 à 0,6 ms par lettre et par taille sur un téléphone simulé, quand une police du système, déjà prête, ne coûte presque rien. Avant ses îlots, l'accueil emploie Clivage à 19 tailles et Barlow à 14 ; données à toute la page d'un coup, les polices faisaient la plus longue tâche du chargement sur mobile (300 à 400 ms au ralenti 4 ×). Le chargeur (`scripts/after-first-paint.mjs`) pose `fonts-staged` avant le premier affichage, charge les polices, puis les donne aux morceaux de la page un par un (`fonts-on`), ceux de l'écran d'abord, chacun dans sa tâche ; `fonts-ready` marque la fin, et le titre du hero attend la sienne pour se briser. Les règles sont dans `css/style.css` (« Polices bloc par bloc »), la liste des polices de chaque langue dans `HOME_FONTS` (`scripts/build-pages.mjs`) : **une nouvelle graisse employée sur l'accueil s'y ajoute**, sinon son texte resterait en police locale (un test le vérifie dans les cinq langues). Sans JavaScript, la page prend ses polices comme avant. Moins de tailles différentes rendrait aussi chaque mise en page plus légère.
- Contenu dans le HTML, aucune image lourde, contrastes AA vérifiés, navigation clavier, `prefers-reduced-motion`, métadonnées, JSON-LD, sitemap.

- **Tout vient du site** (1.9.0) : plus de connexion à ouvrir vers Google Fonts ou jsDelivr, et la version d'exécution seule de Vue (113 Ko au lieu de 175, avant compression).

En local, sur `npm run serve` (mêmes en-têtes et même compression que Netlify), ou sur la version **déployée** (HTTPS) en navigation privée : Chrome DevTools → Lighthouse, ou https://pagespeed.web.dev. La note varie d'un passage à l'autre avec le réseau et la charge de la machine.

## Bande-son (1.12.0)

« Sfumato » est le thème original du site : 3 min 23, mi mineur, 116 BPM joués en demi-temps, en cinq parties (Éveil, Signal, Montée, Apogée, Retour). Aucun fichier audio : chaque note est synthétisée en direct par le navigateur (Web Audio API). L'ossature : pulsation staccato à délai pointé, nappes, basse en sidechain, cloche FM, percussions de film. L'orchestre (1.12.1) : violons et altos, violoncelles et contrebasses, spiccato, cors et trombones, timbales et roulements ; un chœur à quatre voix et une voix soliste par filtres de formants (voyelles qui glissent, port de voix entre les notes liées, seconde voix à l'apogée).

- **Écouter** : l'interrupteur de l'en-tête (`aria-pressed`) coupe et relance le son ; la section « Bande-son » (`#bande-son`, cinquième lien du menu) a le lecteur complet : lecture, position, volume, et les cinq parties, chacune jouable depuis son début. Les deux pilotent le même état (`js/audio/soundtrack.js`, créé dans `js/islands.js` et fourni aux deux îlots). Les touches multimédia et l'écran verrouillé l'affichent aussi (Media Session).
- **Rien au chargement** : le moteur (`sfumato.js`) n'est téléchargé qu'au premier clic. Le son ne démarre jamais seul (règle des navigateurs, et de l'accessibilité).
- **Trois couches** : la partition (`score.js`) dit quoi jouer, l'arrangement (`arrangement.js`) qui le joue et quand, les pupitres (`instruments.js`) comment chacun sonne ; le moteur (`sfumato.js`) mixe et lit. Un appareil de 4 cœurs ou moins joue les ensembles à deux voix par note au lieu de trois (`islands.js`).
- **La partition** (`score.js`) est de la donnée : grille d'accords mesure par mesure, mélodie, parties. Le lecteur et la génération des pages y lisent la durée et le début de chaque partie. La lecture reprend toujours au début d'une mesure.
- **Vérifier un changement** : le moteur sait rendre la partition hors ligne (`renderBars`, `OfflineAudioContext`). Rendre chaque partie, puis comparer niveau, bandes de fréquence, tempo et tonalité : un pupitre trop fort ou une nappe qui « pompe » se voient sur le spectre.
- **Composition originale** : ni échantillon, ni mélodie, ni grille empruntés. Ne citez pas d'œuvre existante dans le site ni dans le code.
