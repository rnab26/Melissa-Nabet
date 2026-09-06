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

## Ce que la page lit dans le manifeste

Rien n'est écrit en dur dans `index.html` : le nom, les rubriques, les sections et les
langues viennent tous du manifeste, écrit par le CRM (Réalisations → « ⚙ Réglages du site »
→ « Mettre le site à jour »). Ajouter une rubrique là-bas la fait apparaître ici sans
toucher au code — c'est la règle à ne pas casser.

```jsonc
{
  "site": {
    "title": "Melissa Nabet",
    "subtitle": { "fr": "Architecture d’intérieur" },   // langue → texte
    "langues": ["fr", "en", "he"],                       // ce que propose le sélecteur
    "categories": [{ "id": "commercial", "label": { "fr": "Commercial" } }],
    "studio":  { "fr": "…" },
    "contact": { "email": "", "tel": "", "ville": "", "instagram": "", "texte": { "fr": "…" } },
    "journal": [{ "id": "j1", "date": "Septembre 2026", "titre": {}, "texte": {} }]
  },
  "realisations": [
    { "id": "r1", "title": "…", "date": "2026", "category": "commercial", "photos": [] }
  ]
}
```

Deux comportements voulus :

- **Une langue sans texte n'est pas une langue vide** : le champ absent du manifeste fait
  retomber la page sur le **français**. On ne publie jamais de traduction automatique.
- **Une réalisation sans `category`** (ou dont la rubrique a été supprimée) reste visible,
  rangée en fin d'index. Elle n'est jamais masquée.

## Vérifier

```sh
node tests/sitetest-build.mjs                    # banc d'essai dans /tmp/mn-sitetest
python3 -m http.server 8902 -d /tmp/mn-sitetest  # dans un autre terminal
node tests/site.test.mjs
```
