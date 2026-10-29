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
