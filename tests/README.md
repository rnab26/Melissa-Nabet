# Tests

Trois suites :

- `tests/realisations.test.mjs` — l'espace **Réalisations** dans le CRM (import, éditeur,
  rendu, synchronisation, sauvegarde, publication vers le site).
- `tests/pont-ia.test.mjs` — le **pont `photo-ia`**, côté serveur : la forme exacte de la
  requête envoyée au fournisseur (sur des schémas relevés sur l'API réelle de fal) et les URL
  de la **file d'attente** — un pont qui suivrait sans la filtrer une URL rendue par le
  navigateur irait chercher n'importe quelle adresse avec la clé du compte. Se lance avec
  `bun tests/pont-ia.test.mjs` (bun exécute le TypeScript du pont). Aucune dépense : ce sont
  des fonctions pures, aucun appel n'est émis.
- `tests/categories.test.mjs` — les **catégories** : menu déroulant dans la fiche (plus de
  champ libre), liste modifiable depuis le CRM, renommage qui suit sur les réalisations,
  ordre publié dans le manifeste, et le bouton « + Nouvelle réalisation » visible sans
  défilement. Port 8899 : `node tests/categories.test.mjs`.
- `tests/site-sections.test.mjs` — le bloc **« Sections du site »** du panneau ⚙ Le site
  public : il doit expliquer, avec les chiffres réels, pourquoi le site n'affiche aucune
  section (rien de publié / aucune catégorie / une seule catégorie) et le confirmer quand
  elles existent. Port 8899 : `node tests/site-sections.test.mjs`.
- `tests/site-langues.test.mjs` — les **langues et le journal** du site, réglés depuis le CRM
  (⚙ Le site public). Suit un texte écrit dans le panneau jusqu'au manifeste, et vérifie
  surtout qu'un champ **non traduit ne part pas vide** en ligne. Serveur sur le port 8899,
  comme la suite Réalisations : `node tests/site-langues.test.mjs`.
- `tests/site.test.mjs` — le **site vitrine public** (`site-vitrine/index.html`), servi
  depuis un banc d'essai local avec un faux manifeste. Vérifie notamment qu'aucune clé
  d'accès ne figure dans la page publique.
- `tests/bout-en-bout.test.mjs` — le **contrat entre les deux** : le CRM publie une vraie
  réalisation, et c'est le manifeste et les images RÉELLEMENT écrits qui sont servis au
  site. Les deux suites ci-dessus vérifient chacune un côté autour d'un manifeste écrit à
  la main : il suffisait qu'un champ soit renommé d'un côté pour que le site cesse de
  l'afficher sans qu'aucun test ne bronche. Se lance seul (il démarre son propre serveur
  sur le port 8903), il faut juste le serveur du CRM sur 8899 :
  `node tests/bout-en-bout.test.mjs`.

La retouche IA est **entièrement interceptée** dans le test du navigateur : le faux pont
rejoue les trois temps de la file de fal (déposer, suivre, récupérer), y compris une demande
qui reste plusieurs sondages en file, une annulation refusée parce que trop tardive, une
demande expirée et une panne de réseau en cours de suivi. **Aucun crédit n'est dépensé.**

Le test ouvre l'appli dans un vrai navigateur avec WebGL, remplace Supabase par un
stockage en mémoire (aucun compte réel n'est nécessaire, aucune donnée réelle n'est
touchée), fabrique une photo de synthèse aux verticales fuyantes et à dominante chaude,
puis **mesure** le résultat du rendu — convergence des verticales, dominante couleur,
luminance, ratio de recadrage. C'est la méthode de vérification de référence pour ce
chantier : ne pas la remplacer par une relecture de code.

## Lancer

```sh
npm i playwright@1.49.1          # une seule fois
python3 -m http.server 8899      # depuis la racine du dépôt, dans un autre terminal
node tests/realisations.test.mjs
```

Pour la suite du site vitrine, construire d'abord son banc d'essai (page locale +
manifeste + dossier d'images), le servir sur le port 8902, puis lancer le test :

```sh
node tests/sitetest-build.mjs                    # construit /tmp/mn-sitetest
python3 -m http.server 8902 -d /tmp/mn-sitetest  # dans un autre terminal
node tests/site.test.mjs
```

`sitetest-build.mjs` recopie le VRAI `site-vitrine/index.html` en ne changeant que
l'adresse du stockage : le test porte donc bien sur la page publiée, pas sur une copie
qui aurait dérivé. Le manifeste de test contient une photo légendée et deux sans légende.

Le test suppose Chromium fourni par l'environnement (`/opt/pw-browsers/chromium`).
Sur une autre machine, retirer la ligne `executablePath` et lancer `npx playwright install chromium`.
