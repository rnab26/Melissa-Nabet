# Tests

Deux suites :

- `tests/realisations.test.mjs` — l'espace **Réalisations** dans le CRM (import, éditeur,
  rendu, synchronisation, sauvegarde, publication vers le site).
- `tests/site.test.mjs` — le **site vitrine public** (`site-vitrine/index.html`), servi
  depuis un banc d'essai local avec un faux manifeste. Vérifie notamment qu'aucune clé
  d'accès ne figure dans la page publique.

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

Pour la suite du site vitrine, servir `sitetest/` (voir en tête du fichier) sur le port
8902, puis `node tests/site.test.mjs`.

Le test suppose Chromium fourni par l'environnement (`/opt/pw-browsers/chromium`).
Sur une autre machine, retirer la ligne `executablePath` et lancer `npx playwright install chromium`.
