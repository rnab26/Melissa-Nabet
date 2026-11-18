# Pour Dan — brancher ton site sur tous les textes du CRM de Mélissa

Ton site (https://melissa-nabet-website.vercel.app) lit déjà le manifeste public du CRM : les
projets, leurs photos, lieu, année, surface, mission, type et description viennent bien de là.
Le CRM publie aussi d'autres textes que ton site n'affiche pas encore. Mélissa les écrit dans
son CRM (⚙ Le site public) et veut qu'ils apparaissent quel que soit le site choisi.

Raphaël a mis ton site comme modèle « Dan vercel » dans le CRM : quand il est choisi, l'adresse
habituelle (https://rnab26.github.io/melissa-nabet-site/) envoie les visiteurs chez toi, vers
`/<langue>` ou `/<langue>/projects/<slug du nom>`. Garde donc ces adresses.

## Le fichier à lire

```
https://njaamykxnvohoesrtpvv.supabase.co/storage/v1/object/public/galerie/797ad2e5-a27a-45c3-a987-d4897d1cadbf/manifest.json
```

Public, sans clé (n'en ajoute aucune). Il change à chaque publication depuis le CRM (cache 5 s) :
le lire à chaque visite ou avec une revalidation courte, comme aujourd'hui.

## Règle générale

- **Champ absent = rien à afficher.** Le CRM n'envoie jamais de champ vide. Si un champ manque,
  garde ton texte actuel ou masque le bloc, comme tu préfères — mais quand il est là, c'est lui
  qui gagne : c'est Mélissa qui l'a écrit.
- **Langues** : le français est dans le champ lui-même ; l'anglais et l'hébreu sont à côté, dans
  `i18n.en` / `i18n.he`, avec les mêmes noms de champs. Traduction absente → français.
- **À ignorer** : `theme`, `redirection`, `mouvement`, `diaporama*`, `cartesPar`, `cartesAlign`,
  `cartesGras` — ce sont les réglages de l'autre site.

## `site` — les textes du studio

| Champ | Ce que c'est | Où l'afficher chez toi |
|---|---|---|
| `title` | Nom (« Melissa Nabet ») | En-tête, pied de page |
| `subtitle` | Sous-titre (« Architecture d'intérieur ») | Sous le nom |
| `accroche` | Phrase d'accueil, 200 car. max | À la place de « Un lieu qui ressemble à ce qu'on y fait. » |
| `apropos` | Qui est Mélissa, comment elle travaille, 700 car. max | Page À propos, à la place du texte « Concevoir des lieux qui travaillent… » |
| `cartes[]` | Blocs `{ titre, texte }` (+ `i18n.en/he`, `large: 2` = pleine largeur, `vide: 1` = case vide à sauter) | Sections « Approche » et « Méthode » : une carte = une étape / un bloc |
| `journal[]` | Actualités `{ date, titre, texte }` (+ `i18n`) | Une page ou une section Journal, si tu veux |
| `email`, `tel`, `instagram` | Coordonnées | Contact, pied de page, bouton WhatsApp (`wa.me` depuis `tel`) |
| `whatsapp` | `"actif"` ou `"aucun"` | Masquer le bouton WhatsApp si `"aucun"` |
| `waTexte` | Message prérempli WhatsApp | `?text=` du lien WhatsApp |
| `menuRealisations`, `menuApropos`, `menuJournal`, `menuBoutique`, `menuPersonnelles` | Mots du menu choisis par Mélissa | Libellés du menu, sinon les tiens |
| `langues` | Langues ouvertes, ex. `["fr","en","he"]` | N'afficher que celles-là dans le sélecteur |
| `categories` | Ordre voulu des types de projets | Ordre des filtres / sections |
| `i18n.en`, `i18n.he` | Mêmes clés traduites (`subtitle`, `accroche`, `apropos`, `menu*`, `waTexte`) | Selon la langue |

## `realisations[]` — les projets (déjà lus en partie)

`id`, `title`, `date`, `lieu`, `surface`, `mission`, `categorie`, `texte` (description du projet),
`personnelle: true` (projet perso, à ranger à part), `i18n.en/he` (`title`, `lieu`, `mission`,
`texte`), `photos[]` (`full`, `thumb`, `w`, `h`, `cover: true` pour la couverture, `caption` =
légende, `i18n.en/he.caption`). Chemins d'images relatifs à
`https://njaamykxnvohoesrtpvv.supabase.co/storage/v1/object/public/galerie/`.

À ajouter si ce n'est pas déjà fait : les **légendes de photos** (`caption`) et les **traductions**
(`i18n`) du nom, du lieu, de la mission et de la description.

## Ce qui n'est pas encore dans le CRM

Les textes de « Interventions » (un paragraphe par type de projet) et l'intro de la page Contact
n'ont pas de champ. Le plus simple : les écrire comme des `cartes` (titre = type, texte =
paragraphe). Si tu préfères un champ dédié, dis-le à Raphaël : on l'ajoute au CRM.

## Pour que Claude puisse aider

Si tu préfères qu'on le fasse à ta place : invite le compte GitHub **rnab26** comme collaborateur
sur le dépôt du site (Settings → Collaborators → Add people), et donne son nom à Raphaël.
