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

## Destination

Ce dossier est la source d'un dépôt distinct : `rnab26/melissa-nabet-site`, servi sur
`https://rnab26.github.io/melissa-nabet-site/`. Il est gardé ici en attendant, et il est
exclu du déploiement GitHub Pages du CRM (voir `.github/workflows/pages.yml` à la racine)
pour ne pas être servi sur le domaine du CRM.
