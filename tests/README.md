# Tests

Vérification automatisée de l'espace **Réalisations** (`tests/realisations.test.mjs`).

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

Le test suppose Chromium fourni par l'environnement (`/opt/pw-browsers/chromium`).
Sur une autre machine, retirer la ligne `executablePath` et lancer `npx playwright install chromium`.
