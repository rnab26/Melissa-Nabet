# Site vitrine — Melissa Nabet

Site public des réalisations. **Séparé du CRM** : les visiteurs n'atterrissent jamais
sur l'application de gestion.

Le contenu vient du bucket Supabase public `galerie`, alimenté depuis le CRM par le
bouton « Publier sur le site ». Seules les réalisations explicitement publiées s'y
trouvent.

**Cette page ne contient aucune clé d'accès.** Elle lit un fichier JSON public et des
images publiques, rien d'autre — elle ne peut, par construction, atteindre aucune
donnée du CRM (clients, devis, documents). Ne jamais y ajouter de clé Supabase, même
« publishable ».

## Où ce code vit, et où il ne faut pas l'écrire

La **source** est le dossier `site-vitrine/` du dépôt du CRM (`rnab26/melissa-nabet`).
C'est le seul endroit où modifier le site.

La **copie servie** est le dépôt `rnab26/melissa-nabet-site`, publié sur
`https://rnab26.github.io/melissa-nabet-site/`. Elle est mise à jour **automatiquement**
à chaque changement de `site-vitrine/` sur `main`, par le workflow
`.github/workflows/sync-site-vitrine.yml` du CRM. Ne rien écrire directement dans le
dépôt du site : la recopie suivante l'effacerait.

Deux choses appartiennent au dépôt du site et ne sont jamais recopiées : son dossier
`.github/` (son propre déploiement Pages, avec le garde-fou `rm -rf docs`) et son
dossier `docs/` (son journal interne).

`site-vitrine/` est par ailleurs exclu du déploiement GitHub Pages du CRM (étape
`rm -rf site-vitrine` dans `.github/workflows/pages.yml` à la racine) pour ne pas être
servi sur le domaine du CRM.
