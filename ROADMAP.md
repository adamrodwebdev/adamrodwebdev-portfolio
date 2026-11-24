# Feuille de route

Le site vitrine reste un site statique sur Netlify. Il fait partie d'un plan en trois zones, décidé le 29 octobre 2026 :

1. **La vitrine** (ce dépôt, adamrodwebdev.com) : statique, durcie, sans aucune requête vers un autre domaine.
2. **L'espace client** (espace.adamrodwebdev.com) : dépôt privé et serveur OVH en France, sur la base Symfony / Vue de Skull Darts 71. Les clients s'y connectent par lien e-mail ou passkey, et les devis et factures y sont émis.
3. **ComptaDev**, l'application de comptabilité, reste hors ligne sur la machine.

## 1.9.0 : durcissement de la vitrine

Statut : validé le 29 octobre 2026, réalisé sur la branche `feat/1.9-durcissement` (PR vers `dev`).

But : plus aucune requête vers un domaine tiers, une politique de sécurité de contenu (CSP) stricte, aucun fichier interne servi, des mentions légales qui nomment chaque sous-traitant. Lighthouse reste à 100 dans les quatre catégories.

### Tout vient du site
- **Vue et vue-i18n** à des versions figées (Vue 3.5.44, vue-i18n 11.4.16), copiés dans le site par la génération à partir de `package-lock.json` (empreintes vérifiées par npm). Plus d'appel à jsDelivr, plus de `preconnect`.
- **Gabarits Vue précompilés** à la génération (`vue/compiler-sfc`, même version que Vue) : le navigateur reçoit des fonctions de rendu et la version d'exécution seule de Vue (environ 40 % de moins à télécharger). Sans cela, Vue compile les gabarits avec `new Function`, et la CSP devrait autoriser `unsafe-eval`.
- **Polices auto-hébergées** dans `fonts/` (WOFF2, sous-ensemble latin, `font-display: swap`) : Rajdhani 500, 600, 700, Barlow 400, 500, 600, et Unbounded 900 réduite aux lettres du titre de Lumirift. Elles restent demandées après le premier affichage.

### Un dossier de publication
- La génération écrit le site dans **`dist/`** (ignoré par Git) : pages générées, feuilles, scripts, médias, démos, polices. Netlify publie `dist/`.
- `README.md`, `CHANGELOG.md`, `ROADMAP.md`, `package*.json`, `templates/`, `scripts/`, `node_modules/` et les fichiers cachés n'y sont jamais copiés : ils ne peuvent plus être servis. Une liste blanche décide de ce qui est copié.
- `index.html`, `en/index.html` et `lumirift/index.html` ne sont plus commités à la racine.

### Une CSP stricte
- `default-src 'none'`, puis seulement `'self'` pour les scripts, styles, polices, images, médias, le manifeste et les envois du formulaire ; `form-action 'self'`, `base-uri 'none'`, `object-src 'none'`, `frame-ancestors 'none'`.
- Aucun `unsafe-inline` ni `unsafe-eval` : la génération calcule l'empreinte SHA-256 de chaque `<script>` et `<style>` en ligne et écrit la CSP dans `dist/_headers`. Les autres en-têtes restent dans `netlify.toml`.
- Les attributs `style="--i:…"` du HTML deviennent des règles CSS. La génération échoue si une page contient un attribut `style` ou un gestionnaire `on…` en ligne.

### Jeux du carrousel (décision du 29 octobre 2026)
- Les fiches mènent aux jeux sur Playgama pour l'instant, et pourront citer d'autres plateformes plus tard (champ `play`, une adresse par plateforme).
- Catapulte Mania et Bastion : leur page Playgama. Ballmania : « À venir », sans lien, jusqu'à sa page Playgama. Lumirift : sa page `/lumirift/`, qui mène à Playgama.
- Les démos hébergées (Catapulte Mania, Ballmania 1.4.2, Lumirift 1.5.0) sont retirées ; leurs adresses redirigent.

### Formulaire de contact
- L'envoi par Vue transmet la case de consentement (`rgpd`), comme le formulaire sans JavaScript. Le pot de miel reste. Aucun serveur ici : la 1.10 enverra le formulaire à l'API de l'espace client.

### Mentions légales et confidentialité (FR / EN)
- Sous-traitants : Netlify, Inc. (hébergement, journaux techniques, réception du formulaire, filtre anti-spam Akismet) et Zoho Mail (Zoho Corporation B.V., centres de données de l'Union européenne) pour contact@adamrodwebdev.com.
- Transfert vers les États-Unis : Netlify adhère au Data Privacy Framework UE–États-Unis (décision d'adéquation du 10 juillet 2023, article 45 du RGPD), avec en secours les clauses contractuelles types de la Commission (décision 2021/914).
- Base légale (réponse à une demande avant contrat, article 6.1.b), durée de conservation (12 mois après le dernier échange), droits et réclamation auprès de la CNIL.
- Plus aucune mention de Google Fonts ni de jsDelivr, puisqu'ils ne sont plus utilisés.

### Vérifications (« fini » quand)
- Lighthouse 100 × 4, pire de trois passages sur mobile, plus l'ordinateur, sur un serveur local qui applique les en-têtes de Netlify (CSP comprise).
- Un script Playwright visite chaque page et ne trouve aucune requête vers un autre domaine ni aucune violation de CSP.
- Le formulaire fonctionne (envoi Vue et envoi sans JavaScript).
- En-têtes de sécurité notés A+ (securityheaders.com et Mozilla Observatory) : vérifiable seulement une fois en ligne.
- Entrée 1.9.0 dans le CHANGELOG, README à jour (dossier `dist/`, `npm ci`, commandes).

## 1.10.0 : le formulaire vers l'espace client
- Le formulaire de contact envoie ses données à l'API d'espace.adamrodwebdev.com au lieu de Netlify Forms ; `connect-src` et `form-action` s'ouvrent à ce seul domaine.
- Mentions légales : OVH (France) remplace Netlify pour les messages.

## 1.14.0 : la police signature

Statut : demandée le 15 novembre 2026 (« une police purement inventée et animée, notre police signature ; nous ne la vendrons pas »), réalisée sur la branche `feat/1.14-police-signature`, en ligne depuis le 16 novembre 2026.

### Ce qui a été décidé (15 novembre 2026)
- **Le sens** : la grandeur de la technologie au repos ; le long de l'axe animé, la rupture d'une humanité divisée autour d'elle, un verre brisé mêlé à un signal perdu.
- **La piste** : Cristal (le verre d'abord), choisie entre deux esquisses animées ; Monolithe (le signal d'abord) écartée.
- **Le rôle** : tout l'affichage (Rajdhani retirée) ; Barlow garde le texte courant.
- **Les caractères** : le latin des cinq langues ; le russe garde les polices système pour ses titres, la signature reste sur le logo, le titre du hero et les numéros.
- **L'animation** : les titres se réparent en apparaissant (à la place des lettres aléatoires), le hero se brise puis se répare au chargement, le logo se fissure au survol ; rien avec « réduire les animations ».
- **Le nom** : Clivage (le plan selon lequel un cristal se fend net, et la fracture qui divise une société), choisi parmi des noms vérifiés dans douze catalogues de polices ; aucune police ne le porte.
- **L'exclusivité** : la police n'est jamais vendue ni réutilisée dans une famille à vendre. Servie par le site, elle reste téléchargeable par qui inspecte la page : ses mentions (copyright, licence, `fsType` « aperçu et impression ») disent qu'aucune utilisation n'est permise ailleurs.

### Vérifications (« fini » quand)
- Lighthouse 100 dans les quatre catégories, pire de trois passages sur mobile, plus l'ordinateur, sur le serveur local qui applique les en-têtes de Netlify.
- Aucun décalage quand la police arrive (repli calé, testé), aucun défilement horizontal de 320 à 2560 px.
- Captures en clair et en sombre, sur téléphone et sur ordinateur.
- Entrée 1.14.0 dans le CHANGELOG, README à jour.

### Ensuite
- Enregistrer l'identifiant de fournisseur `ARWD` (gratuit, auprès de Microsoft) : décidé le 16 novembre 2026, il attend le nom de la fonderie, pour demander les deux identifiants ensemble. Rien ne bloque d'ici là : la police porte déjà `ARWD`.
- Le cyrillique : fait en 1.15.0.

## 1.17.0 : l'offre commerciale

Statut : demandée le 17 novembre 2026 après un audit de la vitrine (« excellente techniquement, mais elle ne vend pas »), maquette validée le même jour, réalisée sur la branche `feat/1.17-offre` (PR vers `dev`). Mise en ligne seulement sur décision. But de l'entreprise : au moins 300 € par mois de revenus récurrents.

### Ce qui a été décidé (17 novembre 2026)
- **L'offre en tête de l'accueil**, avant les services : trois formules (vitrine essentiel dès 1 200 €, vitrine complet dès 2 200 €, application web sur devis), la maintenance et l'hébergement (Veille 49 €, Suivi 79 €, Partenaire 99 € par mois) et un pré-audit d'accessibilité WCAG 2.2 à 390 €. Prix nets (TVA non applicable), légèrement sous le marché freelance de 2026 (1 500 à 3 000 € pour un site vitrine), « à partir de » et ouverts à la discussion.
- **Le pré-audit cite l'Acte européen sur l'accessibilité seulement pour ceux qu'il concerne** (sites marchands des entreprises de 10 salariés ou plus) : les micro-entreprises en sont exemptées pour les services, la cible du site l'est presque toujours.
- **Réalisations et créations séparées** : un carrousel pour les sites et applications, un autre pour les jeux, plus bas. Le menu : Offres, Services, Réalisations, Créations, Contact.
- **Le nom commercial partout** : AdamRodWebTech (logo, titres, données structurées, image de partage, pages annexes).
- **Contact rapide** : un appel vidéo de 15 minutes réservé sur Cal.com, aucun numéro de téléphone exposé ; le bouton n'existe qu'une fois l'adresse donnée. Même règle pour le profil Malt.
- **Témoignages** : une place prête, vide tant qu'aucun vrai avis n'existe. Rien n'est inventé.
- **Abandonné** : l'étude de cas chiffrée de Skull Darts 71.

### Vérifications (« fini » quand)
- Les cinq langues ont les mêmes clés ; prix écrits à la façon de chaque langue.
- `npm test` passe : tests unitaires (liens sortants hostiles, échappement, données structurées) et Playwright (offres, boutons qui choisissent le type de projet, ordre de l'accueil, deux carrousels, blocs absents, marque, sans JavaScript).
- Lighthouse 100 dans les quatre catégories, pire de trois passages sur mobile, plus l'ordinateur.
- Captures en clair et en sombre, sur téléphone et sur ordinateur.
- Entrée 1.17.0 dans le CHANGELOG, README et feuille de route à jour.

### Ensuite
- Créer le compte Cal.com (appel vidéo de 15 minutes) et le profil Malt, puis renseigner `bookingUrl` et `maltUrl`.
- Demander un avis écrit aux premiers clients.

## 1.18.2 : la politique de confidentialité de l'application Lumirift

Statut : demandée le 24 novembre 2026 par la session du jeu, à la demande de l'utilisateur : Google Play exige une adresse publique avant le test fermé de l'application Android (Capacitor, `com.adamrodwebdev.lumirift`). Réalisée sur la branche `feat/1.18.2-lumirift-privacy` (PR vers `dev`). Mise en ligne sur le feu vert de l'utilisateur, avant le test fermé.

### Ce qui a été décidé (24 novembre 2026)
- **L'adresse** : `/lumirift/privacy/`, à côté de la page du jeu. Elle va dans la fiche Google Play et dans l'application : elle ne bouge plus.
- **Le texte** : celui de la session du jeu (anglais, français, indonésien, russe), mis aux règles du site : sa feuille, la marque AdamRodWebTech (le texte disait AdamRodWebDev), l'éditeur identifié comme dans les mentions légales, l'adresse de contact publique du site (`contact@adamrodwebdev.com`), la typographie française. Toute modification se fait d'abord dans le dépôt du jeu, puis ici, avec sa date.
- **Un lien** depuis le pied de la page du jeu.

- **La sauvegarde Android** (1.18.3, même jour) : la section sur le stockage dit où va la copie et comment la couper, d'après le dépôt du jeu (commit 7e9c50c).

### Ensuite
- `app-ads.txt` à la racine du site, quand l'utilisateur aura son identifiant d'éditeur AdMob.

## 1.18.1 : l'accueil sans temps de blocage sur mobile

Statut : demandée le 23 novembre 2026 (« Yes, fix it »), une fois mesuré que la note mobile de l'accueil (96 à 99) ne venait d'aucune branche en cours ; réalisée sur la branche `perf/home-blocking-time` (PR vers `dev`). Mise en ligne sur le feu vert de l'utilisateur.

### Ce qui a été décidé (23 novembre 2026)
- **Mesurer avant de corriger** : une trace de Chrome au ralenti 4 × par variante de la page (sans polices, sans Clivage, sans Barlow, sans îlots, sans `text-wrap`, sans requêtes de conteneur, Clivage figée, Barlow sous le nom de Clivage, polices appliquées ensemble ou bloc par bloc), puis Lighthouse en passages alternés.
- **Les polices bloc par bloc** plutôt qu'en une fois : le coût vient du nombre de lettres et de tailles qu'une police web doit mesurer, pas de Clivage elle-même. Le design ne change pas.
- **Les deux carrousels à l'approche de leur section** ; le formulaire et le lecteur restent montés au démarrage (les boutons des offres choisissent le type de projet dans le formulaire, l'interrupteur de l'en-tête pilote le lecteur).
- **Une taille par rôle** (« Yes, add them », sur une page de captures avant / après de chaque section, téléphone sombre et clair, ordinateur) : six jetons pour les tailles fixes de l'interface, dans la même version. Laissés tels quels exprès : le logo, le titre du hero, les prix, les titres de section, la paire 16 / 16,18 px (texte des cartes contre texte courant : la fondre grossirait le texte des cartes de 12 % sur ordinateur) et les graisses.

### Vérifications (« fini » quand)
- `npm test` passe, dont trois nouveaux tests : chaque texte de l'accueil finit dans une police du site chargée, dans les cinq langues, menu mobile compris ; les blocs de l'écran d'abord, un par tâche ; sans JavaScript, la page prend ses polices comme avant.
- Lighthouse mobile en passages alternés avec la 1.18.0, machine au repos : temps de blocage simulé plus bas, note de 99 à 100.
- Entrée 1.18.1 dans le CHANGELOG, README à jour.

## 1.18.0 : la licence des polices Ressac

Statut : demandée le 18 novembre 2026 pour la fonderie Ressac (« Oui, crée-la »), réalisée sur la branche `feat/1.18-licence-ressac` (PR vers `dev`). La convention avec le médiateur CM2C, que nomme l'article 17, est signée le 18 novembre 2026 (valable jusqu'au 18 novembre 2029) : la licence finale, en vigueur depuis le 18 novembre 2026, est en place. Mise en ligne sur le feu vert de l'utilisateur.

### Ce qui a été décidé (18 novembre 2026)
- **Deux pages, une par langue** : `/ressac/licence/` (le français, qui prévaut) et `/en/ressac/licence/`. La case « Conditions » du paiement Gumroad y renvoie : la licence est le contrat entre le vendeur et l'acheteur (conditions de Gumroad, 6.7). Chaque page dit que la française prévaut et mène à l'autre.
- **Pas de licence en russe, en italien ni en espagnol** : un texte juridique ne se traduit pas sans relecture. Pour ces langues, les moteurs de recherche reçoivent l'anglaise (`x-default`), comme pour les mentions légales.
- **Le texte mot pour mot** : copies exactes des fichiers de la fonderie (`type-foundry`, `licence/EULA.fr.md` et `EULA.en.md`, commit `dbf34ba`), vérifiées à chaque génération par leur identifiant Git. Rien n'est reformulé : la page ajoute un sommaire, des ancres et l'encadré de langue.
- **Une page faite pour lire un contrat** : le sommaire des 18 articles, de l'annexe et de l'historique (une colonne qui suit la lecture sur grand écran), des ancres stables (`#article-14`, `#section-14`, `#article-10-4` pour chaque interdit) et un saut immédiat, un texte sélectionnable titres compris, un tableau trop large qui défile dans son cadre sur téléphone (celui des prix, à trois colonnes, se replie), l'impression en noir sur blanc.
- **La médiation de la consommation** (demandée le 18 novembre 2026, une fois CM2C signé) : le site n'a pas de conditions générales de vente, la clause de CM2C va donc dans les mentions légales (`#mediation`), en français telle que CM2C la fournit et en anglais ; le russe, l'italien et l'espagnol, qui mènent aux mentions anglaises, y trouvent chacun la clause dans leur langue. Chaque version dit que la médiation se fait en français.
- **La typographie française au rendu** : les fichiers de la fonderie emploient des espaces ordinaires ; la page française les rend insécables là où le français le veut (avant ; : ! ?, dans les guillemets, les nombres et les numéros de téléphone), sans changer un mot.
- **Les mentions légales en polices du système**, comme la licence : la page anglaise se décalait de 0,02 à l'arrivée de Barlow.
- **Le texte du contrat en polices du système**, comme le texte courant des pages russes ; les titres gardent la signature. Avec Barlow, le texte se recomposait à l'arrivée de la police (décalage de 0,12 sur ordinateur, et une ancre glissait de 300 px), même avec un repli calé. À valider avec l'utilisateur.

### Vérifications (« fini » quand)
- `npm test` passe : tests unitaires (copies identiques à la source, texte rendu mot pour mot, ancres, balisage refusé, échappement) et Playwright (sommaire, langues, liens alternatifs, sélection, ancre juste après l'arrivée des polices, aucun défilement horizontal de 320 à 2560 px, thème).
- Lighthouse 100 dans les quatre catégories, pire de trois passages sur mobile, plus l'ordinateur, sur les deux pages.
- Captures en clair et en sombre, sur téléphone et sur ordinateur.
- Entrée 1.18.0 dans le CHANGELOG, README à jour.

### Avant la mise en ligne
- La convention CM2C signée et la licence finale recopiée (commit `dbf34ba` de type-foundry : CM2C, polices achetées sur MyFonts, prix de la boutique pour une famille) : fait le 18 novembre 2026.
- Le feu vert de l'utilisateur, une fois les contrôles GitHub verts, puis la fusion dans `dev` et la publication.

## 1.20.0 : l'emblème en 3D

Statut : demandée le 23 novembre 2026 (« Is it possible to implement the new 3D effect with the logo from the marketing session in the portefolio ? »), prototype validé le même jour (« Yes, integrate it »), réalisée sur la branche `feat/1.20-emblem-3d` (PR vers `dev`).

### Ce qui a été décidé (23 novembre 2026)
- **L'effet du film de la marque, refait en code** : le film (rendu Blender) et son son ne vont ni dans ce dépôt public ni dans le site, par leur propre licence ; la vidéo transparente aurait aussi pesé environ 3 Mo, sans transparence sur Safari. Le geste est le même (éclats, éclair, coutures qui se referment, reflet) ; l'éclairage du verre et du métal, non.
- **L'arrivée seulement**, une fois par chargement, l'emblème à l'écran ; il reste entier ensuite.
- **À la place de l'emblème dessiné au trait** : les anneaux et le panneau restent ; le panneau passe sous l'emblème.

### Vérifications (« fini » quand)
- `npm test` passe : tests unitaires du découpage et Playwright (arrivée, mouvement réduit, hors de l'écran, sans JavaScript, aucune violation de CSP).
- Lighthouse 100 dans les quatre catégories sur l'accueil, pire de trois passages sur mobile, plus l'ordinateur, et comparé à `dev` en passages alternés.
- Captures sur téléphone et sur ordinateur, en clair et en sombre.
- Entrée 1.20.0 dans le CHANGELOG, README à jour.

## 1.15.0 : la signature parle russe

Statut : demandée le 16 novembre 2026 (« Enchaîne sur le cyrillique »), réalisée sur la branche `feat/1.15-cyrillique`, en ligne depuis le 16 novembre 2026 avec la 1.14.1 (versions v1.14.0 et v1.15.0 sur GitHub).

### Ce qui a été décidé (16 novembre 2026)
- **Tout l'alphabet russe** : les 33 lettres, capitales et minuscules, Ё et Й compris. Les lettres que le russe partage avec le latin reprennent les dessins de la signature (le А cyrillique est son A) ; les autres sont taillées dans le même cristal et se brisent sur le même axe.
- **Un fichier par alphabet**, choisi par `unicode-range` : une page latine ne paie pas le cyrillique ; une page russe prend les deux (chiffres, ponctuation et logo latins).
- **En russe, le texte courant garde les polices du système** : Barlow n'a pas de cyrillique.
- **Le menu des langues fermé n'est pas mis en page** : sinon, le « Русский » du menu faisait venir le fichier cyrillique sur les pages latines.

### Vérifications (« fini » quand)
- Lighthouse 100 dans les quatre catégories, pire de trois passages sur mobile, plus l'ordinateur, sur `/`, `/en/` et `/ru/`.
- Aucun décalage quand la police arrive, en français comme en russe (repli calé cyrillique, testé).
- Captures de `/ru/` en clair et en sombre, sur téléphone et sur ordinateur, entières et brisées.
- Entrée 1.15.0 dans le CHANGELOG, README à jour.
