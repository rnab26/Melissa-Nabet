# Journal de bord — sessions autonomes

Ce fichier est tenu par les sessions Claude qui travaillent seules sur le dépôt. Il dit
**où en est le travail**, pas comment travailler (ça, c'est `CLAUDE.md`). Le détail
technique de chaque chantier reste dans `PROJECT_LOG.md` ; ici, on tient le fil.

Source de vérité de ce qui reste à faire : le **tableau des chantiers**
<https://claude.ai/code/artifact/c7ead2fa-509a-4bf4-a2c5-ac18a5063d84>

---

# À ton retour — l'essentiel en une page

*(Écrit le 5 septembre 2026, après une session de nuit menée seule. Le détail de chaque
point est plus bas, dans l'ordre chronologique.)*

**Tout est en ligne et vérifié.** CRM et site public déployés, CI verte.
**393 contrôles au navigateur, 65 sur le site public, 8 sur le pont IA — 0 échec.**
*(Deux sessions ont travaillé en parallèle sur ce dépôt ; la suite de tests est commune.)*

## Ce qui a changé, par ordre d'importance pour toi

| | Ce que tu pourras faire à l'ouverture |
|---|---|
| **Galerie** | Ranger les photos (glisser-déposer à la souris, ◀ ▶ au doigt), les **renommer et les légender**, **remplacer** une photo sans perdre sa place, voir la **progression d'un import** et la raison exacte de chaque fichier refusé (HEIC d'iPhone compris). Menu ⋯ par vignette, ◀ ▶ dans l'éditeur, et des **filtres dans la grille** au-delà de six chantiers. |
| **Retouche IA** | Une consigne, **toute la série** : coût annoncé avant, plafond qui bloque, interruption possible, bilan des échecs. **Plusieurs versions par photo** : chaque retouche s'ajoute au lieu d'écraser, et on choisit à partir de laquelle on relance. |
| **Éditeur** | **Annuler / Rétablir** (et Ctrl+Z), et le **cadrage se fait au doigt** — on tire la photo au lieu de viser un curseur. |
| **Site public** | Fiche de projet avec **lieu, surface, mission, texte de présentation** ; **filtre par catégorie** ; **photos verticales par deux** comme dans un vrai portfolio ; **« Projet suivant »** (et flèches du clavier) ; **section À propos et contact** (vide, elle t'attend) ; **aperçu correct quand on partage le lien** sur WhatsApp ; balayage au doigt et plein écran pilotable au clavier ; images plus légères sur téléphone. |
| **Téléphone** | Le menu principal passe **en bas**, la barre du haut ne fait plus qu'une ligne : ~115 px d'écran regagnés. Vérifié écran par écran : rien ne passe sous la barre. |
| **Sécurité des données** | **Sauvegarde complète (.zip)** avec les photos en pleine définition, et le **retour en arrière** qui les remet en place. **Alerte** quand le stockage se remplit. |
| **Au quotidien** | **Recherche globale** (Ctrl+K) sur tout le CRM, jusque dans les légendes. Rappel **« à republier »** sur le tableau de bord. Clients ↔ réalisations ↔ devis enfin **reliés dans les deux sens**. Une session Claude qui démarre **charge l'état du projet toute seule**. |

## Ce qui t'attend, et rien d'autre

1. **Écrire le texte « À propos »** et choisir les coordonnées publiques du site
   (onglet Réalisations → « ⚙ Le site public »). Livré **vide** : je n'invente pas de
   contenu à la place de Mélissa. Tant que c'est vide, ni la section « À propos », ni
   l'invitation à écrire en bas de chaque projet n'existent.
2. **Juger le texte produit par « ✨ Rédiger un texte »** sur une vraie réalisation :
   il faut une session connectée, je n'ai pas pu le voir.
3. **Regarder la nouvelle navigation du téléphone** et me dire si elle te va. Tout tient
   dans un bloc `@media` : la retirer est immédiat.

*Aucune clé, aucun compte, aucune dépense, aucun réglage dans un tableau de bord tiers.*

## Deux choses à savoir

- **`ph14` (file d'attente fal.ai) est fait** (5 septembre, entrée juste en dessous) : un
  appel ne peut plus expirer en étant facturé, et fermer la page ne perd plus une retouche.
  **Rester en 2K quand même** — la contrainte technique est levée, mais la photo part au
  modèle en 1600 px et le site publie en 1600 px : le 4K coûterait le double pour rien.
- Une **autre session** a automatisé la recopie du site vitrine vers son dépôt
  (`.github/workflows/sync-site-vitrine.yml`). Ne plus recopier à la main.

---

## 6 septembre 2026 — Les catégories deviennent une liste, et créer un projet se voit

**Branche** `claude/categories-liste-0609`. **Chantier** `eaf36cf0`.

Ses mots ce matin : « pas de possibilité de créer un nouveau projet […] pas d'attribution à
la catégorie du chantier si c'est du commercial, bureau, ou habitation, ou une création
personnalisée. C'est pas assez logique, j'ai pourtant expliqué toutes ces choses à maintes
reprises, pourquoi ça ne le fait pas automatiquement ? » Il a raison sur les trois points, et
la cause était de notre côté.

### La cause racine

La catégorie était un **champ de texte libre** avec « ex. Appartement » en indication. Rien
ne se rangeait tout seul parce que rien n'était à ranger : il fallait deviner qu'il fallait
taper un mot, et deux orthographes du même mot auraient fabriqué deux sections sur le site.

### Livré

- **La catégorie est un menu déroulant**, alimenté par SES quatre sections — Commercial,
  Habitation, Bureaux, Réalisation sur mesure — plus « — aucune — » et une dernière ligne
  « ✎ Gérer les catégories… » qui ouvre les réglages. Plus aucune saisie libre.
- **La liste se gère depuis le CRM** (⚙ Le site public → Sections du site) : ajouter,
  renommer, monter, descendre, supprimer. Chaque ligne affiche **combien de réalisations la
  portent** — supprimer n'est jamais un geste aveugle.
- **Renommer suit sur les réalisations** qui portent l'ancien nom. Sans ça le projet gardait
  le mot d'avant, disparaissait de sa section et réapparaissait dans une section fantôme :
  une perte de rangement parfaitement silencieuse.
- **L'ordre part dans le manifeste** (`site.categories`) et le site le respecte : « Commercial,
  Habitation, Bureaux » est un ordre voulu, pas un tri alphabétique. Une catégorie portée par
  un projet mais absente de la liste reste affichée, à la fin.
- **« + Nouvelle réalisation » en tête de l'onglet**, en bouton principal, comme « + Nouveau
  client ». La tuile en fin de grille existait, mais après la liste : sur un téléphone il
  fallait la chercher.
- **Le panneau dit ce qui est RÉELLEMENT en ligne.** Il lit le manifeste publié et compare :
  « Attention : le site affiche « Épure », pas « Index ». Votre choix ne sera en ligne
  qu'après Mettre à jour le site. » C'est exactement le piège dans lequel il est tombé.

### Migration, et ce qu'il ne faut pas casser

`siteCategories()` garantit que **toute catégorie déjà portée par une réalisation figure
dans la liste**, même héritée de l'ancien champ libre. Sans ça, un projet perdrait son
rangement au premier chargement. Le test « une valeur héritée de l'ancien champ libre n'est
jamais perdue » protège ce point — ne pas le supprimer.

`RZ_CATS` et `rzCatsConnues()` (liste figée + champ libre) ont été retirés : ils
fabriquaient exactement le problème que Raphaël décrit.

### Point 4 de la relance : rien à refaire

L'écran des versions de photos livré cette nuit **se voit** dans l'écran qu'il utilise :
bouton « ⬆ Republier (1) » et la phrase « 1 photo en ligne à jour, en attente : 1 nouvelle —
Republier montre le détail avant d'envoyer quoi que ce soit ». Vérifié au navigateur en
390 px, capture `/tmp/crm-versions.png`.

### Ce qui reste de sa main, et une seule fois

Le thème **Index** ne peut pas être posé depuis une session : écrire le manifeste demande sa
clé Supabase, qui vit dans son navigateur. **⚙ Le site public → première vignette (Index) →
Mettre à jour le site.** Le panneau lui dira désormais si son choix est appliqué ou non.

À noter, et c'est mesuré et non supposé : avec **un seul projet en ligne**, « Index » réduit
son chantier à une ligne et une vignette de 58 px, quand « Épure » lui donne une grande
photo. Le conseil qui lui a été donné est de garder Épure jusqu'à quatre ou cinq chantiers.

### Vérification

`tests/categories.test.mjs` — **nouveau, 18 contrôles, 0 échec**, en 390 px : du bouton de
création jusqu'à l'ordre des catégories dans le manifeste, renommage et doublons compris.
`tests/realisations.test.mjs` **463/463**, `tests/site.test.mjs` **99/99** (le filtre suit
désormais l'ordre du CRM, plus l'alphabet), sections 7/7, langues 20/20, bout-en-bout 20/20.

---

## 6 septembre 2026 — « Je ne vois rien de spécial » : ce qu'il manquait vraiment

**Branche** `claude/site-sections-lisible-0609`.

Raphaël a mis le site à jour et n'a rien reconnu de ce qu'il avait choisi. Il avait raison
sur les trois points. Diagnostic tiré du **manifeste réellement en ligne**, pas d'une
supposition :

| Ce qu'il attendait | Ce que dit le manifeste |
|---|---|
| la direction « Index » | `theme: "epure"` — il a cliqué la mauvaise vignette |
| des sections commercial / habitation / bureaux | `categorie: null` sur sa seule réalisation |
| « un truc qui a été fait » | 1 projet, 6 photos, aucun texte de présentation |

### Ce qui a été corrigé

Le panneau **⚙ Le site public** ne disait nulle part **pourquoi** aucune section
n'apparaît. Il porte maintenant un bloc « Sections du site » qui l'explique avec **ses
chiffres à lui**, et nomme le geste à faire :

- aucune réalisation publiée → il le dit ;
- publiées mais **aucune catégorie renseignée** (son cas) → « c'est pour ça qu'aucune
  section n'apparaît. Ouvrez une réalisation, remplissez son champ Catégorie… » ;
- **une seule** catégorie → le site n'affiche toujours rien : un choix unique n'est pas un
  choix, il en faut au moins deux ;
- deux ou plus → confirme les sections en ligne, et signale les réalisations publiées qui
  n'ont pas de catégorie (visibles, mais dans aucune section).

### Ce qui a été constaté, et qu'aucun code ne corrigera

Avec **un seul projet**, la direction « Index » est un mauvais choix : le sommaire
typographique réduit son chantier à une ligne et une vignette de 58 px. Rendu côté à côté
sur ses vraies photos (`/tmp/reel-epure.png`, `/tmp/reel-index.png`) : **« Épure » — ce
qu'il a activé par erreur — est objectivement plus flatteur pour lui aujourd'hui**, parce
que la grande photo occupe l'écran. « Index » deviendra le bon choix quand il aura dix
chantiers en ligne. C'est écrit dans la description du thème (« Le mieux quand il y en a
beaucoup »), mais visiblement pas assez tôt dans le parcours.

**Le vrai blocage reste le même, et il n'est pas graphique** : un projet, aucun texte
« À propos », aucune catégorie. Tant que ça ne bouge pas, changer d'habillage ne changera
rien à l'impression qu'il a en ouvrant le site.

### Vérification

`tests/site-sections.test.mjs` — **nouveau, 7 contrôles, 0 échec** : les quatre situations
(rien de publié, publié sans catégorie, une seule catégorie, deux ou plus), en 390 px.
`tests/realisations.test.mjs` 442/442 et `tests/site-langues.test.mjs` 20/20 — aucune
régression.

---

## 6 septembre 2026 — Le site en trois langues, et un journal

**Branche** `claude/site-langues-journal-0509`. **Chantier** `eaf36cf0-9664-45ed-b536-a7f861a489ee`
(identité du site). **Fiche de décision**
<https://claude.ai/code/artifact/0a5981ec-e66c-4ec9-86dd-500d76843969>.

### Ce qui s'est passé, et pourquoi ce chantier a changé de forme

La fiche d'identité demandait cinq choses : direction **index**, accueil en **grille**,
mouvement **discret**, **trois langues** (français, anglais, hébreu), et quatre sections
(**réalisations, studio, contact, journal**).

Une session parallèle a livré, pendant que celle-ci travaillait, le thème « index », la
grille, le mouvement discret, les catégories et la section « À propos / contact ». Une
première version de ce chantier, écrite sur un `main` plus ancien, refaisait tout ça de son
côté : **la fusionner aurait écrasé leur travail**. Elle a donc été abandonnée — elle reste
poussée sur `claude/site-identite-index-0509` si quelque chose y était bon à reprendre, mais
elle n'a pas vocation à être fusionnée.

Il restait deux demandes non couvertes, et ce sont elles qui sont livrées ici : **les trois
langues** et **le journal**.

### Les trois langues

- **Sélecteur FR / EN / עב** dans l'en-tête, qui n'apparaît que si le site propose plus d'une
  langue. Le choix est retenu d'une visite à l'autre.
- **L'hébreu bascule toute la page en lecture de droite à gauche** : mise en page en miroir,
  flèches du plein écran inversées.
- **L'interface est traduite** (navigation, filtres, états, « projet suivant », « écrivez-moi »).
  Ce sont des mots d'appareil, pas les mots de Melissa.
- **Ses textes à elle ne sont pas traduits automatiquement.** Tant qu'une traduction manque,
  c'est le **français d'origine** qui s'affiche. Poser une traduction machine sous son nom
  n'était pas une option : c'est elle qui parle sur ce site.
- Dans le CRM (⚙ Le site public), un onglet par langue : les mêmes champs, langue par langue,
  et une mention explicite « Non traduit — le français s'affichera » là où il manque du texte.

**La forme des données est volontairement ADDITIVE** : le français reste dans les champs
d'origine du manifeste (`subtitle`, `apropos`), et les autres langues arrivent à côté, dans
`i18n`. Rien à migrer, et le manifeste actuellement en ligne — qui ne connaît ni langues ni
journal — continue de s'afficher correctement (vérifié : il a son propre banc d'essai).

### Le journal

Des notes datées, affichées après les projets, alimentées depuis le CRM : ajouter, écrire,
réordonner, supprimer avec confirmation. **Sans entrée, la section n'existe pas sur le site**
— pas d'onglet « Journal » qui ouvre sur du vide. La date est commune aux trois langues (elle
ne se traduit pas) ; titre et texte se traduisent.

### Trois défauts corrigés en route

1. **`siteSettings()` remplaçait `library.site` par un nouvel objet à chaque appel.** Garder
   son résultat puis appeler une fonction qui la rappelle — ce que fait n'importe quelle
   poignée un peu composée — laissait écrire dans un objet devenu orphelin, jamais sauvegardé,
   sans le moindre signal. C'est ce qui faisait qu'activer une langue « ne prenait pas ».
   Elle complète maintenant **en place**. Même famille de bug que celui documenté sur les
   fiches clients.
2. **`renderApropos()` lisait l'état global** au lieu de l'objet qu'on lui passe : la fonction
   n'affichait plus ce qu'on lui donnait, et devenait intestable.
3. **Ponctuation cassée en hébreu.** Un texte français non traduit, affiché dans une page en
   lecture de droite à gauche, voyait son point final partir au début de la ligne
   (« .Texte de présentation »). C'est exactement l'état dans lequel le site est livré tant
   que les traductions manquent. Tout ce que Melissa écrit porte maintenant `dir="auto"` :
   chaque texte garde son propre sens de lecture.

### Vérification

Tout au navigateur (Chromium), rien de déduit :

- `tests/site.test.mjs` — **86 contrôles, 0 échec** (langues, hébreu en miroir, ponctuation
  bidirectionnelle, journal, ancien manifeste).
- `tests/site-langues.test.mjs` — **nouveau, 20 contrôles, 0 échec** : le panneau du CRM en
  390 px, jusqu'à ce qui part réellement dans le manifeste.
- `tests/realisations.test.mjs` — **442 contrôles, 0 échec**. Aucune régression.
- `tests/bout-en-bout.test.mjs` — **20 contrôles, 0 échec**.
- Captures : `/tmp/v2-mobile-fr.png`, `/tmp/v2-hebreu-corrige.png`.

### Ce qu'il ne faut pas casser

- **Le français est la langue de repli**, pas une langue comme les autres : il ne peut pas
  être décoché, et un champ vide dans une autre langue **ne part pas** dans le manifeste —
  sinon le site afficherait du vide au lieu de retomber sur le français.
- `siteSettings()` **complète en place**. Ne pas revenir à un `Object.assign` qui réaffecte
  `library.site` : ça réintroduit le bug de l'objet orphelin.
- `dir="auto"` sur tout ce qui vient du CRM. Un titre de projet ajouté ailleurs sans ce
  marquage se cassera en hébreu, et personne ne le verra en français.
- Le manifeste reste **rétrocompatible** : `subtitle` et `apropos` sont le français, `i18n`
  est un supplément. Déplacer le français dans `i18n.fr` casserait le site en ligne.

### Vérifié après coup : « Index » s'affiche-t-il vraiment ? (oui, mais il faut son clic)

Personne n'avait regardé. C'est fait, et par le chemin réel — un manifeste portant
`theme: "index"`, pas un thème posé à la main par le test : **le sommaire s'affiche
correctement, y compris sur un écran de 390 px** (petite vignette de 58 px à gauche, nom à
sa droite, aucun débordement, aucune image restée invisible). Capture `/tmp/index-390.png`.

**MAIS le site en ligne n'est PAS encore en « Index ».** Le manifeste publié aujourd'hui ne
porte aucun `theme` — la page retombe donc sur `atelier`, l'habillage par défaut. Vérifié
en lisant le manifeste public :
`{title, subtitle, email, tel, instagram}` et une seule réalisation, sans catégorie.

> **Une manipulation de Raphaël, et une seule :** CRM → Réalisations → **⚙ Le site public**
> → cliquer **Index** dans « Allure du site » → **« Mettre à jour le site »**. Aucune session
> ne peut le faire à sa place : écrire le manifeste demande sa clé Supabase, qui reste dans
> son navigateur. Le même clic met aussi en ligne les langues et le journal.

Deux détails relevés en regardant l'écran :

- **« 1 photos »** s'affichait sur une réalisation qui n'a qu'un cliché. Corrigé (`nbPhotos`),
  dans les trois langues.
- Sur un projet qui porte à la fois un lieu et une mission, la ligne d'information **passe à
  la ligne** en 390 px (« 2026 · TEL AVIV · RÉNOVATION / COMPLÈTE »). Ça tient, rien n'est
  coupé, mais c'est serré. Pas touché : l'habillage appartient au chantier voisin, et c'est
  une question de goût, pas un défaut.

### Ses quatre sections, proposées d'emblée

Ses mots : « commercial, habitation, bureaux, réalisation sur mesures ». La catégorie d'une
réalisation est un **champ libre** avec des suggestions, et le site construit ses filtres à
partir de ce qui est publié — la modularité qu'il demande est donc déjà là, sans code à
toucher. Ce qui manquait : ses quatre mots n'étaient nulle part. Ils sont maintenant **les
quatre premières suggestions**, avant les autres. Le champ reste libre, et tout ce qui a
déjà été tapé continue de s'y ajouter.

### Ce qui reste, et qu'il faut dire à Raphaël

1. **Une seule réalisation est réellement en ligne.** Aucune identité ne donnera l'effet d'un
   site de studio avec une photo : les cinq références du relevé reposent sur dix projets et
   de grandes images. Le chantier suivant n'est pas graphique, il est photographique.
2. **Trois langues, c'est trois fois le texte à écrire.** La mécanique est livrée et le
   français est en place ; l'anglais et l'hébreu attendent ses mots, dans ⚙ Le site public,
   onglet par onglet.
3. **Les titres et textes des projets ne sont pas encore traduisibles** — seuls le sous-titre,
   l'à-propos et le journal le sont. C'est volontaire : ça se décide quand il y aura de quoi
   traduire.

---

## 5 septembre 2026 — Quelle version part sur le site (et comment revenir en arrière)

**Branche** `claude/photos-version-publiee-0509` → fusionnée sur `main`. **Chantier Jarvis** `ae41e91f-1660-4afb-ab23-b0406d0f3ffe`.

**Signalé par Raphaël** : « les photos que je retouche, je ne sais pas quand je fais
republier, ça republie les anciennes photos. Il faudrait créer une certaine logique des
photos et de republication des photos sur le site. Parce qu'actuellement il n'y a aucune
logique pour savoir quelle photo est envoyée sur le site. »

### Ce que disent le code et les vraies données (lu, pas déduit)

Trois causes donnaient le même symptôme. Deux sont écartées **par la mesure** :

1. **« La publication lit l'original »** — non. `publishRealisation` passe par
   `loadPhotoImage`, qui suit `photoActiveId(p)` : c'est bien la version retenue qui est
   rendue. *(Deux défauts voisins existaient quand même, corrigés ici : voir plus bas.)*
2. **« Le fichier déployé n'est pas réécrit »** — non. Relevé dans le vrai seau `galerie` :
   les six `p*.jpg` de « Bureau Sébastien » portent tous `updated_at = 2026-09-05 20:46`,
   l'heure de la dernière publication. Ils **sont** réécrits à chaque fois.
3. **« L'adresse publique ne change pas »** — **oui, et c'est structurel.** Le nom du
   fichier était positionnel (`p0.jpg`, `t0.jpg`…) : il ne dépendait ni de la version ni des
   réglages. Rien, dans toute la chaîne, ne distinguait une image neuve d'une ancienne.
   En-têtes relevés le 5 septembre sur le vrai stockage : les images sont écrites avec
   `cacheControl: max-age=3600` et servies par Cloudflare (`x-smart-cdn: true`) en
   `cache-control: no-cache`. Le navigateur doit donc revalider — mais **rien ne garantit**
   qu'il voie la nouvelle image : l'invalidation du CDN n'est pas instantanée, et toute
   couche qui respecte le `max-age=3600` stocké sert l'ancienne. *Non vérifié en conditions
   réelles* : mesurer un écrasement sur le vrai seau demandait une clé de service que le
   garde-fou de la plateforme a refusé de révéler. Je ne l'ai donc pas contourné.

**Mais la cause profonde est en amont, et c'est celle que Raphaël décrit** : une photo
n'avait **aucun état vis-à-vis du site**. Le manifeste ne disait pas quelle version il
servait, et la photo ne gardait qu'une **date** de publication. Republier ne pouvait que
deviner, et le CRM ne pouvait rien montrer avant d'envoyer.

**Deux faux signaux constatés dans les vraies données**, qui expliquent le « je ne sais
jamais » :

- « à republier » se déclenchait sur `touchedAt > publishedAt`. Or **renommer** une version
  ou une photo touche cette date. Au moment du signalement, la photo « The Open Space »
  était marquée *à republier* pour un simple renommage à 20:48 — alors que le site était
  parfaitement à jour. On republie, rien ne change à l'écran : « ça republie les anciennes ».
- Une photo illisible au moment de la publication était **sautée en silence** (`continue`).
  Comme les noms étaient positionnels, toutes les photos suivantes changeaient d'adresse et
  la dernière était effacée comme orpheline — sans un mot.

### Ce qui est livré

- **Une photo publiée sait quelle version est en ligne.** `p.pub` porte la signature exacte
  des pixels publiés (version retenue + réglages + définition de sortie), le nom du fichier,
  la légende et la couverture. `r.pub` fait de même pour l'ordre et la fiche du projet.
- **L'adresse publique porte le contenu** : `<idPhoto>-<empreinte>.jpg`. Une retouche part à
  une **nouvelle adresse** — aucun cache ne peut servir l'ancienne. Rien ne change ⇒ même
  adresse ⇒ **aucune image réécrite**.
- **Avant de publier, un écran montre photo par photo ce qui est EN LIGNE et ce qui VA
  PARTIR**, côte à côte, avec la raison en clair (« Retouche 2 » au lieu de « Retouche 1 »,
  réglages, légende, couverture) et le compte en tête. Rien ne part sans confirmation. Quand
  rien n'a changé, il le dit au lieu de faire semblant, et propose quand même de republier.
- **Retour en arrière en un appui**, sous le bandeau d'état, avec la date à laquelle il
  ramène. Les images du pas précédent ne sont pas effacées : le retour est **immédiat et
  gratuit**, et lui-même réversible.
- **Le rappel « à republier » ne ment plus** : il compare ce qui est en ligne à ce qui
  partirait. Renommer ne le déclenche plus ; changer de version, régler, légender,
  réordonner, oui.
- **La pile de versions dit laquelle est sur le site** (repère 🌐) et l'éditeur l'écrit en
  toutes lettres.
- **Réordonner ne réécrit plus aucun fichier** : l'ordre vit dans le manifeste.
- **Une photo illisible arrête la publication en la nommant** au lieu d'être sautée.

**Corrections trouvées en chemin** (même famille, même symptôme) :

- La texture WebGL était mise en cache sous une clé dérivée de la **photo**, à la
  publication (`'pub_'+p.id`) comme à la vignette (`'t_'+p.id`). Après un changement de
  version, le rendu pouvait donc réutiliser la texture de la version précédente — et
  publier, ou afficher, l'ancienne image. La clé désigne maintenant l'**image** rendue.
- `migratePhotoVersions` ne nettoyait `ia`/`useIa` que sur une photo non encore migrée. Une
  fusion venue d'un autre appareil les recopiait après coup : constaté en base sur une vraie
  photo, qui portait `versions` **et** `ia`. Le nettoyage est maintenant fait dans tous les cas.

### La preuve

`tests/bout-en-bout.test.mjs` : le CRM publie une vraie réalisation, on **retouche** une
photo (posée exactement comme `iaStoreResult`, **sans appeler le modèle — aucun crédit
dépensé**), on republie, et on **mesure la couleur des pixels réellement affichés** par la
page publique servie depuis le stockage écrit par le CRM.

- avant : `rgb(159,148,136)` — le gris chaud de l'originale ;
- après, **dans le navigateur qui avait déjà ouvert le site** (cache chaud) :
  `rgb(33,98,183)` — le bleu de la retouche, à une adresse différente ;
- idem dans un contexte de navigateur entièrement neuf.

**Total : 555 contrôles, 0 échec** (après fusion avec les chantiers arrivés entre-temps). `realisations` 442 (23 nouveaux), `bout-en-bout` 20
(8 nouveaux), `site` 73, `pont-ia` 20.

**Croisement avec « Tout republier d'un coup »** (arrivé sur `main` pendant ce chantier) :
sa correction est juste et a été reportée dans la nouvelle publication — `p.pub` et
`p.publishedAt` ne sont posés qu'**après** l'écriture du manifeste. Tant qu'il n'est pas
écrit, le site ne sait rien des images envoyées : les marquer en ligne avant ferait
disparaître le rappel « à republier » alors que rien n'est parti. Deux de ses tests
simulaient « des photos qui ont bougé » en **antidatant** ; l'état ne se déduisant plus de
dates mais de ce qui est réellement en ligne, ils font maintenant bouger l'image pour de
bon. Un garde-fou de 30 s a été ajouté sur leur attente de confirmation : une mise en place
devenue fausse doit échouer, pas attendre indéfiniment.

**Croisement avec « Remplacer une photo » et « Import : plus de fichier fantôme »** :
remplacer une photo réécrit la **même clé de stockage** (`rp_<id>`) et remet les réglages à
zéro — la signature publiée aurait donc été identique, et le site aurait gardé l'ancienne
image en se croyant à jour. `photoPubSig` compte désormais `p.imgRev`, incrémenté par
`replaceOnePhoto`. **Toute écriture future sous une clé d'image déjà publiée doit incrémenter
ce compteur**, sinon le changement passera inaperçu. Parcours réel à 390 px : écran de publication, fiche
avec le retour en arrière, barre d'actions — aucun débordement horizontal
(`/tmp/mn-publication-390.png`).

### Ce qu'il ne faut pas casser

- `realisationPublishPlan(r)` est **la source unique** de « ce qui partirait ». Le bandeau,
  le compte sur le bouton, l'écran de confirmation et la publication s'en servent tous : les
  faire diverger, c'est annoncer une chose et en publier une autre.
- `photoPubSig(p)` ne doit contenir **que** ce qui change les pixels écrits. Y ajouter un
  titre ou un libellé de version ferait revenir le faux « à republier » qui a causé le
  signalement.
- Le nom du fichier publié **n'est plus positionnel**. La note du 4 septembre disant que
  réordonner change l'adresse de toutes les photos suivantes **ne vaut plus** : l'ordre est
  celui du manifeste.
- Le ménage des fichiers garde ce qui est servi par la publication **actuelle et par la
  précédente**. Élargir l'effacement casserait le retour en arrière.
- Une photo publiée **avant** ce mécanisme n'a pas de `p.pub` : elle retombe sur l'ancien
  repère par date et reste « en ligne ». Retirer ce repli ferait crier « à republier » sur
  tous les chantiers déjà à jour.
- La publication ne doit **jamais** sauter une photo en silence.

### Croisement avec l'autre session

Aucun conflit sur le pont fal.ai ni sur la file d'attente : le chantier est en aval. Les
seuls points de contact dans `index.html` sont le panneau de versions de l'éditeur (ajout du
repère « en ligne », classe `.ia-ver-site` distincte de `.ia-ver-meta`) et
`migratePhotoVersions` (une ligne). Diff volontairement minimal à ces deux endroits.

### Ce qui reste ouvert

- `r.pub` et `r.pubPrev` recopient l'identité publiée de chaque photo et la fiche du
  manifeste précédent : environ 4 Ko par réalisation de vingt photos, synchronisés avec le
  reste. Négligeable aujourd'hui, à surveiller si les réalisations se multiplient.
- **Un seul pas de retour en arrière**, pas un historique. C'est ce que « revenir » veut dire
  quand une retouche vient d'être publiée ; un vrai historique des publications serait un
  autre chantier.
- L'effet réel du CDN Supabase sur un écrasement n'a **pas** été mesuré (clé de service
  refusée par le garde-fou de la plateforme). Le correctif rend la question sans objet — une
  image différente a une adresse différente — mais ce n'est pas une mesure.

### À faire côté Raphaël

**Rien.** Le site vitrine (`site-vitrine/index.html`) n'a **pas** été touché : il lit les
chemins que le manifeste lui donne, quels qu'ils soient. À la première republication d'une
réalisation ancienne, ses images seront réécrites une fois sous leur nouvelle adresse, et
les anciens `p0.jpg` retirés du seau.

---

## 6 septembre 2026 — Choisir ce qui part sur le site, et pourquoi le solde reste muet

**Branche** `claude/publication-choix` → fusionnée sur `main`. **Chantiers** `cr06` (nouveau)
et `ph12`.

**Demandé par Raphaël** : « je ne vois toujours pas mes crédits fal.ai » et « quelle photo je
sélectionne en version finale, et ensuite lesquelles je choisis pour les pousser sur le
site, ce n'est toujours pas assez clair ».

### Ce qui est livré

- **La version publiée se choisit depuis la grille.** Menu ⋯ d'une vignette → « 🖼 Version
  publiée : Retouche 2 » → la liste s'ouvre, l'originale et chaque retouche, l'active
  cochée. Un appui, c'est fait. Avant, il fallait ouvrir l'éditeur et descendre dans
  l'onglet Retouche.
- **Une photo peut être écartée du site.** Menu ⋯ → « 🚫 Ne pas publier cette photo ». Elle
  reste dans le CRM, dans les sauvegardes et dans l'archive ; elle ne part plus sur la page
  publique, et elle en est retirée à la prochaine publication. La vignette passe en retrait
  avec la pastille « écartée du site ». Le geste inverse est au même endroit.
- **L'écran de publication le dit avant d'envoyer** : « 4 photo(s) sur 5 partiront sur le
  site », les écartées comptées à part, et **le nom de la version retenue sous chaque
  vignette « va partir »**. Deux vignettes qui se ressemblent ne laissent plus deviner
  laquelle est publiée.
- **Si la couverture choisie est écartée**, c'est la première photo publiée qui la remplace —
  annoncé sur l'écran de publication, pas décidé en silence.
- **Tout écarter ne publie pas une galerie vide** : refus explicite, sur l'écran de
  confirmation comme sur « Tout republier ».

### Le solde fal.ai — vérifié, et voilà où ça bloque

Les journaux de la fonction en ligne disent, à chaque appel :
`balance: HTTP 403 authorization_error — This API key is not permitted to perform this action.`

Vérifié aussi dans la documentation de fal (page d'authentification et liste des API de
compte) : **aucun point d'entrée accessible avec une clé de portée API ne donne le solde**.
Il faut une clé de portée ADMIN, et créer une clé sur un compte fal.ai demande d'être
connecté à ce compte — je ne peux pas le faire à sa place.

Ce qui a changé, faute de pouvoir le régler moi-même : la pastille **ne disparaît plus en
silence**. Elle affiche « non lu » et un appui ouvre la marche à suivre — trois étapes
numérotées, avec le lien direct vers `fal.ai → Keys`, le lien direct vers les secrets du
projet Supabase, et le nom exact du secret (`FAL_ADMIN_KEY`). La clé qui fait tourner les
modèles n'est pas touchée. Se taire complètement laissait sans réponse la question « où sont
mes crédits ? » : l'endroit où on les cherche devenait vide, sans un mot.

### Un défaut trouvé en chemin, par le test

Publier avec une couverture écartée marquait la photo de remplacement « à republier » **pour
toujours** : la publication la posait comme couverture, la comparaison « qu'est-ce qui a
changé » la comparait à un autre choix, et les deux ne se rejoignaient jamais.
`couvertureEffective(r)` est maintenant la seule définition de la couverture, partagée par
les trois.

**Vérification** : `tests/realisations.test.mjs` → **462 contrôles, 0 échec** (17 nouveaux) ;
`tests/bout-en-bout.test.mjs` → 20 ; `tests/site.test.mjs` → 99 ; `tests/pont-ia.test.mjs` →
20. Parcours réel en 390 px sur la grille et le menu ⋯.

### Ce qu'il ne faut pas casser

- `photosPubliees(r)` est **la** liste de ce qui part sur le site, et `couvertureEffective(r)`
  **la** couverture. Le plan, la publication, les décomptes et l'écran de confirmation
  s'en servent tous : une deuxième définition et une photo reste « à republier » sans fin.
- Une photo écartée compte comme **retirée du site** dans le plan, au même titre qu'une photo
  supprimée : dans les deux cas le visiteur ne la verra plus.
- Le garde-fou « tout est écarté » vaut aussi dans `publishRealisation`, pas seulement sur
  l'écran de confirmation : « Tout republier » appelle la publication directement.

### À faire côté Raphaël

**Une seule chose, et elle n'est pas automatisable** : pour voir le solde dans le CRM, créer
sur [fal.ai → Keys](https://fal.ai/dashboard/keys) une clé de portée **ADMIN** et la déposer
dans les secrets Supabase sous le nom `FAL_ADMIN_KEY`. Le mode d'emploi est dans le CRM :
onglet Retouche → pastille « Solde non lu » → **?**.

---

## 5 septembre 2026 — Savoir ce qu'on regarde (et un geste en moins)

**Branche** `claude/photo-etat-affiche` → fusionnée sur `main`. **Chantier** `ph18`.

**Signalé par Raphaël, capture à l'appui** : « ça m'affiche comme quoi c'est la photo
originale, alors que ce n'est pas la photo originale ; quand je clique sur la photo, ça
monte une autre photo, je ne sais pas faire la distinction entre les deux. Le sélecteur
n'affiche qu'une seule photo. Je voulais faire la retouche sur cette photo, ça ne s'est pas
fait. »

### Ce que disent les vraies données (lues en base, pas déduites)

- La photo en question porte **`rot: 12`** — une rotation manuelle de 12°, la valeur maximale
  du curseur. Aucune autre photo de la série n'en a.
- Elle a **zéro version** et un **historique vide** : aucune retouche n'a jamais été posée
  dessus.
- `iaUsage` du mois = **6 appels**, et les autres photos totalisent **6 versions**. Donc
  **aucun appel perdu, rien de facturé pour rien** : la retouche de cette photo n'a pas
  échoué, elle n'a jamais été lancée.
- `iaJobs` est vide : aucune demande en vol.

Les « deux photos » étaient donc la même image, **avec et sans les 12° de rotation** —
l'appui long montrait la photo brute.

### Les trois vrais défauts, et ce qui est corrigé

1. **Rien ne disait ce qu'on regarde.** L'écran annonçait « Photo d'origine » alors qu'il
   affichait la photo d'origine **plus** des réglages manuels. Une ligne en tête de tous les
   onglets le dit maintenant : « À l'écran : Photo d'origine + vos réglages (rotation 12,0°) »,
   avec un bouton **↺ Annuler mes réglages** qui nomme ce qu'il va effacer.
2. **Le geste n'était annoncé que sur ordinateur.** L'indice vivait dans la barre du haut, et
   une règle CSS (`@media(max-width:680px){.ed-cmp{display:none}}`) le masquait sur téléphone
   — c'est-à-dire précisément là où il sert. Il est descendu dans le panneau, visible partout.
3. **Un geste de trop.** L'appui long faisait la même chose que le curseur avant/après, en
   moins clair. **L'appui long est supprimé** : le curseur sert aux deux cas — comparer deux
   versions, ou comparer la photo avec et sans vos réglages. Quand il n'y a que des réglages,
   le partage n'apparaît **que pendant le geste** : sinon on réglerait l'exposition en ne
   voyant que la moitié de la photo.

**Au passage** : sans aucune retouche, la liste « À partir de » n'avait qu'une entrée — un
choix qui n'en est pas un, et qui laissait croire qu'une version manquait. Elle ne s'affiche
plus qu'à partir de deux.

**Vérification** (après fusion avec les chantiers arrivés entre-temps) :
`tests/realisations.test.mjs` → **401 contrôles, 0 échec**, dont 7 ajoutés ici — le cas exact
signalé, une photo sans retouche portant `rot:12`, rejoué à 390 px ;
`tests/pont-ia.test.mjs` → 20 ; `tests/site.test.mjs` → 60.

### Ce qu'il ne faut pas casser

- Le partage avant/après reste **permanent** quand une autre version est en face (c'est le
  mode de lecture d'une photo retouchée, et c'est ce que Raphaël préfère), et **transitoire**
  quand il n'y a que des réglages manuels. C'est `_ed.imgAlt` qui fait la différence, pas un
  réglage.
- L'indice ne doit **pas** remonter dans `.ed-bar` : cette barre doit tenir sur une ligne sur
  téléphone (56 px, mesuré), c'est pour ça qu'il y était masqué.
- `editResume()` est la seule écriture de « comment on nomme un réglage manuel » : la ligne
  d'état, la confirmation de remise à zéro et les futurs messages s'en servent.

### À faire côté Raphaël

**Rien de technique.** Pour cette photo : les 12° sont toujours là — un appui sur « ↺ Annuler
mes réglages » la remet droite, puis « ✨ Retoucher cette photo » lance la retouche qui n'a
jamais été lancée.

---

## 5 septembre 2026 — Plusieurs versions par photo, et le choix de ce qu'on retouche

**Branche** `claude/photo-versions` → fusionnée sur `main`. **Chantier** `ph17`.

**Signalé par Raphaël** : « quand je fais une modification de photo, je n'ai pas le choix de
réutiliser l'ancienne photo… ce serait pratique de pouvoir modifier vraiment n'importe
quelle photo qu'on veut et accéder sur la même photo. »

**Ce qui n'allait pas.** Une photo n'avait que deux états : l'originale et UNE retouche.
Relancer une retouche écrasait la précédente — sans avertissement, et pour un appel facturé.
Et l'envoi repartait **toujours** de l'originale : impossible d'affiner un résultat en
repartant de lui.

### Ce qui est livré

- **Une pile de versions par photo.** Chaque retouche s'ajoute au lieu d'écraser. Celle qui
  est choisie s'affiche, s'exporte et part sur le site ; les autres restent à un geste.
- **« À partir de »**, juste au-dessus du bouton d'envoi : l'originale ou n'importe quelle
  version. **Par défaut, celle qu'on regarde** — on retouche ce qu'on voit. L'écran dit ce
  qu'implique de repartir d'une image déjà redessinée.
- **La pile est cliquable** : l'originale et chaque retouche, avec le modèle, la version dont
  elle sort, la date et la consigne. **Renommer** (« Retouche 2 » ne veut plus rien dire au
  bout de trois jours) et **supprimer**, avec une confirmation qui rappelle que l'image a été
  payée.
- **Chaque version garde ses propres réglages** (verticales, lumière, cadrage) : ils suivent
  la version, ils ne la traversent pas.
- **Le comparateur** met en face la version dont sort celle qu'on regarde, pas l'originale
  par principe.
- **La série** propose le même choix, mais repart de l'originale **par défaut** : enchaîner
  vingt photos sur des sorties déjà redessinées ferait dériver toute la série sans que ça se
  voie.
- **Les retouches déjà faites sont conservées** : elles deviennent la version 1 et gardent
  leur clé de stockage. Rien à refaire, rien à repayer.

**Vérification** : `tests/realisations.test.mjs` → **376 contrôles, 0 échec** (31 nouveaux) ;
`tests/pont-ia.test.mjs` → 20 ; `tests/site.test.mjs` → 52. Pont intercepté, **aucun crédit
dépensé**. Parcours réel en 390 px sur la pile de versions.

### Ce qu'il ne faut pas casser

- `iaStoreResult` reste **le seul endroit qui pose un résultat** (photo seule, série,
  reprise). Elle empile une version, elle n'en remplace jamais une.
- `photoAllKeys(p)` est **la** liste des images d'une photo : tout chemin qui supprime une
  photo doit passer par elle, sinon des images payées resteront dans le seau sans plus rien
  pour les nommer.
- L'archive de sauvegarde emporte **toutes** les versions, et son index porte la clé réelle.
  Les archives faites avant retombent sur l'ancienne règle : ne pas retirer ce repli.
- Supprimer une version **rattache ses descendantes à sa propre origine**, sinon leur champ
  `from` désignerait une version disparue.
- Le panneau porte deux listes déroulantes : celle des modèles s'attrape par `.ia-model-sel`.

### Ce qui reste ouvert

Rien ne limite le nombre de versions. À ~1 Mo l'image, cinq essais sur vingt photos font
100 Mo sur un plan de 1 Go — c'est l'alerte de saturation (`fi01`) qui préviendra. Aucun
ménage automatique : supprimer sans qu'on le demande une image déjà payée serait pire que le
problème.

### À faire côté Raphaël

**Rien.** En ligne après le déploiement Pages.

---

## 5 septembre 2026 — La retouche passe par la file d'attente de fal

**Branche** `claude/photo-ia-queue` → fusionnée sur `main`. **Chantier** `ph14`.

**Le problème** : le pont appelait `fal.run` et attendait la fin dans la requête. Sur une
image lourde ou une file chargée chez fal, la fonction serveur expirait **avant** la
réponse : l'image était perdue — et facturée quand même, puisque le modèle avait tourné.
C'est ce qui interdisait le 4K, et ce qui rendait la retouche en série risquée (elle
multiplie les appels longs).

**Ce qui est livré**

- **Trois temps courts au lieu d'un appel bloquant** : déposer la demande
  (`POST queue.fal.run/<modèle>`), demander où elle en est (`…/requests/<id>/status`),
  récupérer l'image (`…/requests/<id>`). Aucun ne dépend de la durée du modèle, donc aucun
  ne peut expirer.
- **L'attente se voit** : le bouton dit « En file d'attente · 3ᵉ · 12 s », puis « Le modèle
  travaille… », puis « Récupération de l'image… ». Sous le bouton : *vous pouvez fermer
  cette page*.
- **Annuler** est possible depuis l'éditeur et depuis la série. Tant que la demande n'a pas
  démarré, elle **n'est pas facturée** et le compteur du mois revient en arrière. Si l'appel
  a démarré, c'est dit franchement : il sera facturé. Si fal répond « trop tard », la
  demande est **gardée** — son image est payée, on va la chercher.
- **Fermer la page ne perd plus rien.** La demande est écrite sur le disque *avant* d'être
  suivie, et reprise automatiquement à la réouverture, avec un bandeau dans Réalisations qui
  nomme chaque demande en attente, son modèle et son ancienneté. Boutons « Reprendre
  maintenant » et « Abandonner » (avec confirmation qui dit que ça reste facturé).
- **Réglable** dans ⚙ Réglages → *File d'attente* : intervalle de vérification (1-60 s,
  défaut 3) et temps d'attente maximum (1-120 min, défaut 10). Passé ce délai le CRM cesse
  de *regarder* — la demande, elle, continue et sera reprise.

**Vérification** (après fusion avec les 29 commits arrivés sur `main` pendant ce chantier) :
`tests/realisations.test.mjs` → **345 contrôles, 0 échec**, dont **46 ajoutés ici** ;
`tests/pont-ia.test.mjs` → **20, 0 échec** (12 ajoutés) ; `tests/site.test.mjs` → 52, 0
échec. Le pont est intercepté : **aucun crédit dépensé**. Parcours réel en 390 px pendant
l'attente et sur le bandeau de reprise : aucun débordement. Fonction `photo-ia` déployée en
**version 6**, et ses deux garde-fous rejoués sur la fonction réellement en ligne : 401
« authentification requise » sans jeton, 401 « session invalide » avec la clé publiable.

### La contrainte « rester en 2K » — réponse explicite

**La contrainte technique est levée.** Elle venait du délai de la fonction serveur ; il n'y
a plus d'appel dont la durée dépend du modèle, et une demande déposée n'est plus perdable.

**Mais rester en 2K reste le bon réglage aujourd'hui**, pour trois raisons qui n'ont rien à
voir avec la file :

1. La photo part au modèle **en 1600 px** (`glRenderTo(…,1600,…)`) : il n'a aucun détail 4K
   sur quoi travailler.
2. La publication écrit **en 1600 px** (`PUB_FULL`) : une sortie 4K serait réduite aussitôt.
3. Le coût à peu près **double** (0,13 → 0,24 $ l'image chez Nano Banana Pro), et la version
   IA est stockée en pleine taille à côté de l'original — sur un plan Supabase à 1 Go
   (chantier `fi01`).

**Conditions pour passer en 4K** : monter d'abord la résolution d'envoi ET `PUB_FULL`,
accepter le coût double et la place occupée. Tant que le site publie en 1600 px, c'est une
dépense sans effet visible. Le panneau de réglages l'écrit maintenant en clair, au lieu de
laisser le 4K se choisir sans conséquence apparente.

### Ce qu'il ne faut pas casser

- **`iaStoreResult` reste appelée d'un seul endroit** — désormais `iaCollectJob`, partagée
  par la retouche d'une photo, la série et la reprise. Trois chemins, une seule règle de
  pose.
- **Une demande n'est jetée que si on SAIT qu'il n'y a plus rien à récupérer** : expirée chez
  fal, annulée, ou échec rendu par le modèle (`e.definitif`). Réseau coupé, serveur muet,
  délai dépassé : la demande **reste** dans la liste. Ne pas « simplifier » en supprimant sur
  toute erreur — ce serait jeter des images payées.
- **La demande est comptée au dépôt**, pas à l'arrivée : sinon le plafond mensuel ne verrait
  rien d'une série en vol. Elle est décomptée **uniquement** si fal accepte l'annulation
  alors qu'elle était encore en file.
- **`sync_mode` ne part pas en mode file** (`buildPayload(..., {sync:false})`) : il ferait
  renvoyer l'image en base64 dans la réponse stockée, pour rien. En appel synchrone hérité,
  il reste posé.
- **Le pont ne suit une URL rendue par fal que si elle est sur `queue.fal.run`**
  (`safeQueueUrl`), et refuse tout identifiant de modèle ou de demande biscornu. Sans ça, il
  deviendrait un relais capable d'aller chercher n'importe quelle adresse en présentant la
  clé du compte. Testé.
- `library.iaJobs` est **synchronisé** avec le reste de la bibliothèque : une demande déposée
  depuis le téléphone peut être récupérée depuis l'ordinateur. Revers : deux onglets ouverts
  peuvent reprendre la même demande et poser deux fois le même résultat (même image, deux
  lignes d'historique). Pas gênant en pratique, mais c'est connu.
- L'action `edit` (appel synchrone) est **conservée** dans le pont pour les pages restées
  ouvertes sur l'ancienne version. Ne pas la retirer sans savoir que plus personne ne l'appelle.

### Ce qui reste ouvert

- **La série reste séquentielle.** La file permettrait de déposer les 20 photos d'un coup et
  de tout récupérer ensuite (bien plus rapide), mais ça change le sens du plafond et de
  l'interruption. À faire séparément si l'usage le demande.
- Pas de **webhook** : le CRM est une page statique, il n'a pas d'adresse publique où fal
  pourrait pousser le résultat. Le sondage est la bonne réponse ici.
- **Rien n'a été vérifié contre le vrai fal en exécution** : ce serait une dépense réelle.
  Les formes HTTP viennent du `openapi.json` réellement publié par fal (vérifié sur trois
  modèles), pas de la documentation rédigée — qui, elle, donne une URL de résultat
  différente (`/requests/<id>/response`). Le pont suit d'abord les URL que fal renvoie
  lui-même à la soumission, ce qui rend le point discutable sans objet.

### À faire côté Raphaël

**Rien.** Fonction serveur déployée (v6), CRM fusionné et déployé.

## 4 septembre 2026 — Galerie : l'ordre, les mots, le remplacement, un import qui se voit

**Branche** `claude/galerie-ordre-legendes` → fusionnée sur `main`.
**Chantier du tableau** : `ph09` (réordonner) + ce qui manquait autour.

### Ce qui est livré et vérifié

- **Réordonner les photos.** Bouton « ⇅ Réordonner » dans la fiche d'une réalisation.
  Deux gestes, parce qu'aucun ne marche partout : **glisser-déposer** à la souris (avec un
  repère qui montre où la photo va tomber) et **◀ ▶** au doigt. Chaque vignette porte son
  rang ; ★ marque la couverture. « Trier par date d'ajout » remet la série dans l'ordre
  d'import, avec confirmation. **C'est cet ordre qui est publié sur le site.**
- **Titre et légende par photo.** Le pied de chaque vignette est cliquable : titre (interne,
  pour se repérer) et légende (publiée sous la photo sur le site, 200 caractères, compteur,
  bouton pour l'effacer). Les photos sans légende affichent « ＋ légende » au lieu de rien.
- **La légende part vraiment sur le site** : elle s'affiche sous la photo, en plein écran,
  et sert de texte alternatif. **Le titre, lui, ne quitte jamais le CRM** — c'est souvent le
  nom de fichier de l'appareil photo, il n'a rien à faire sur une page publique.
- **Remplacer une photo** (menu ⋯ d'une vignette, ou depuis l'éditeur). La photo garde son
  identifiant, sa place, son titre et sa légende ; la version IA et les réglages de
  l'ancienne image sont supprimés (ils ne veulent plus rien dire), et c'est annoncé dans la
  confirmation.
- **Import lisible.** Barre de progression « 3 / 20 · cuisine.jpg » pendant l'envoi, puis un
  bilan qui **reste à l'écran** et liste chaque fichier refusé avec sa raison : trop lourd
  (avec le poids et la limite), pas une image (avec son type), **HEIC d'iPhone** (avec la
  manip pour y remédier), fichier illisible. Avant, un refus disparaissait en trois secondes
  ou passait sous silence.
- **Menu ⋯ sur chaque vignette** : ouvrir l'éditeur, titre et légende, mettre en couverture,
  remplacer, télécharger. La croix reste pour retirer une photo (avec confirmation, comme
  avant).
- **Éditeur photo : ◀ ▶ pour passer d'une photo à l'autre** avec le rang affiché (2 / 12),
  sans repasser par la grille. « Titre et légende » et « Remplacer » y sont accessibles quel
  que soit l'onglet.

**Vérification** : `tests/realisations.test.mjs` → **183 contrôles, 0 échec** (45 nouveaux
sur ce chantier) ; `tests/site.test.mjs` → **22 contrôles, 0 échec** ; `tests/pont-ia.test.mjs`
→ 8, 0 échec. Parcours réel à l'écran en 390 px (grille, refus d'import, mode réordonner,
menu, dialogue de légende, éditeur) : aucun débordement horizontal, rien d'illisible.

### Ce qu'il ne faut pas casser

- L'ordre de `r.photos` **est** l'ordre du site : la publication écrit `p0.jpg`, `p1.jpg`…
  dans cet ordre. Réordonner change donc l'adresse publique de toutes les photos qui
  suivent — c'est pourquoi un déplacement marque **toute la réalisation** « à republier »,
  pas seulement la photo déplacée.
- `replaceOnePhoto` remet `_glTexKey=''`. La texture WebGL est mise en cache sous une clé
  dérivée de l'identifiant de la photo, qui ne change pas au remplacement : sans cette
  remise à zéro, l'écran continue d'afficher l'ancienne image.
- Ne pas publier `p.name` dans le manifeste. Un test le vérifie explicitement.
- Le bilan des refus d'import journalise volontairement dans la console (`import photo
  Error: image illisible`) : c'est ce qui rend un refus diagnosticable à distance. Le test
  final filtre ce message, ne pas le « corriger ».
- `tests/sitetest-build.mjs` recopie le vrai `site-vitrine/index.html` en ne changeant que
  l'adresse du stockage. Ne pas figer une copie du site dans le banc d'essai : le test ne
  porterait plus sur la page réellement publiée.

### Ce qui reste ouvert sur ce chantier

- Le **glisser-déposer tactile** n'est pas implémenté (le HTML5 drag-and-drop ne fonctionne
  pas au doigt). Sur téléphone, ce sont les ◀ ▶ qui rangent. Un glisser tactile maison est
  faisable (~0,5 j) si l'usage montre que les flèches ne suffisent pas.
- Rien. Le **site vitrine** (dépôt séparé `rnab26/melissa-nabet-site`) a été mis à jour dans
  la foulée : `site-vitrine/index.html` y a été recopié à l'identique, fusionné et déployé.
  **Vérifié sur la page réellement servie** : `https://rnab26.github.io/melissa-nabet-site/`
  répond 200 et contient bien le code des légendes.

### À faire côté Raphaël

**Rien.** Tout est en ligne : CRM (déploiement Pages réussi, run 99) et site public.

---

## 4 septembre 2026 — Une consigne IA pour toute une série

**Branche** `claude/photo-ia-serie` → fusionnée sur `main`. **Chantier** `ph05` (haute).

**Le problème** : écrire trois lignes de consigne puis les retaper photo par photo. Un
chantier fait dix à vingt photos ; c'était le vrai frein à l'usage de la retouche.

**Ce qui est livré** : bouton « ✨ Retoucher plusieurs photos » dans la fiche d'une
réalisation, et « ✨ Retoucher (n) » dans la barre de sélection.

- **Portée au choix** : la sélection en cours, les photos qui n'ont pas encore de version IA
  (par défaut — on ne repaie pas ce qui est déjà fait), ou toutes.
- **Avant de lancer** : nombre de photos, **coût estimé**, cumul du mois. Le chiffre se met
  à jour quand on change de portée.
- **Plafond mensuel** : bloque le lancement (rien n'est envoyé, donc rien n'est facturé), et
  prévient à l'avance s'il doit tomber au milieu de la série.
- **Interrompre** : l'arrêt se fait après la photo en cours, et le bouton le dit — un appel
  déjà parti est facturé de toute façon, autant en garder le résultat.
- **Une photo refusée n'arrête pas les suivantes** : le bilan de fin nomme chaque échec avec
  sa raison et reste à l'écran (vert quand tout est passé, rouge sinon).

**Vérification** : 207 contrôles au navigateur (24 nouveaux), pont intercepté — **aucun
crédit dépensé par les tests**. Parcours réel en 390 px : dialogue, progression, bilan.

### Ce qu'il ne faut pas casser

- `iaStoreResult` est **la** règle de pose du résultat sur une photo, partagée par la
  retouche d'une photo seule et par la série. Ne pas la redupliquer : les deux chemins
  finiraient par diverger sans que rien ne le signale.
- Le bilan de série porte la classe `rz-bilan-serie` en plus de `.ia-erreur` : le bilan
  d'import utilise la même apparence, et les tests doivent pouvoir les distinguer.
- Le mode d'appel reste **synchrone** (`fal.run`). Chantier `ph14` toujours ouvert : sur une
  image lourde ou une file chargée, la fonction serveur peut expirer et l'appel est perdu
  tout en étant facturé. **Rester en 2K, ne pas passer en 4K** tant que la file d'attente
  n'est pas branchée. La série multiplie les appels longs : c'est elle qui rend ph14 urgent.

### Remarque d'usage (pas encore traitée)

La barre d'actions d'une réalisation porte maintenant six boutons (Publier, Retoucher
plusieurs photos, Réordonner, Sélectionner, Tout télécharger, Supprimer). Ça tient sur
téléphone (quatre lignes, aucun débordement mesuré) mais ça commence à faire beaucoup.
Piste : passer « Tout télécharger » et « Supprimer » dans un menu ⋯ au niveau de la
réalisation, comme ce qui a été fait pour les vignettes. À décider avec Raphaël.


---

## 4 septembre 2026 — Alerte de saturation du stockage

**Branche** `claude/infra-quota` → fusionnée sur `main`. **Chantier** `fi01` (haute).

**Le risque** : le plan gratuit Supabase plafonne à 1 Go. À une photo d'environ 1 Mo, ça
tient un à deux ans — puis un import échoue, et rien n'explique pourquoi.

**Livré** : bandeau dans l'onglet Réalisations dès le seuil réglé (70 % par défaut), avec le
pourcentage, **la place restante exprimée en photos** (calculée sur la taille moyenne réelle
des fichiers déjà stockés) et quoi faire pour en récupérer. Au-delà de 95 %, le ton change :
les prochains envois vont échouer. Capacité du plan et seuil se règlent dans Sauvegarde →
Synchronisation, avec refus motivé des valeurs absurdes.

**Correction au passage** : l'ancienne jauge ne comptait que le seau `client-docs`, et
seulement son premier niveau. Elle ignorait donc **tout ce qui est publié sur le site**
(seau `galerie`, rangé en sous-dossiers par réalisation) — c'est-à-dire une bonne part de la
place réellement occupée. Le comptage descend maintenant dans les sous-dossiers et
additionne les deux seaux.

### Ce qu'il ne faut pas casser

- `bucketBytes` traite une entrée **sans métadonnées** comme un dossier (c'est ainsi que
  Supabase renvoie les préfixes) et descend d'un niveau, deux au maximum. Sans cette
  descente, la galerie compte pour zéro.
- La mesure est mise en cache deux minutes (`STORAGE_TTL`) : elle coûte deux listings.
  `storageInvalidate()` est appelé après un import, une suppression, une publication et un
  retrait du site — si un nouveau chemin fait varier la place occupée, il doit l'appeler
  aussi, sinon la jauge ment jusqu'à l'expiration du cache.
- Le seuil et la capacité vivent dans `library.storage` : ne pas revenir à des valeurs en
  dur, le plan Supabase peut changer.

---

## 5 septembre 2026 — Lieu, surface, mission et texte de présentation

**Branche** `claude/site-textes` → fusionnée sur `main`. **Chantier** `si03` (haute).

**Le constat du tableau des chantiers** : « un vrai projet a un lieu, une surface, une année,
une description. Aujourd'hui il n'a qu'un nom et une date : c'est une galerie de photos, pas
un portfolio. »

**Livré côté CRM** : quatre champs de plus dans la fiche d'une réalisation — lieu, surface,
type de mission (six missions courantes proposées, champ libre quand même) et un **texte de
présentation** avec compteur de caractères et un état vide qui dit ce que ça change.

**Rédaction assistée** : bouton « ✨ Rédiger un texte ». Il passe par la **même fonction
serveur** que le bouton « Embellir » des devis (la clé Anthropic ne quitte jamais le
serveur), mais avec `kind='realisation'` : un projet de portfolio ne se raconte pas comme
une ligne de devis. Les légendes des photos partent comme matière. Un échec n'écrase jamais
le texte déjà écrit et reste affiché avec quoi faire à la place.

**Livré côté site** (dépôt miroir mis à jour et déployé) : année · lieu · surface · mission
sous le titre du projet, puis le texte en paragraphe. Un champ vide ne s'affiche pas du tout.
Sur les cartes de la liste, lieu et mission remplacent le décompte de photos — sauf quand ils
manquent, où l'on retombe sur le décompte.

**Fonction serveur `embellish` déployée en version 11**, `verify_jwt` toujours désactivé
(volontaire, cf. plus haut dans PROJECT_LOG). **Vérifié en vrai sur l'URL de production** :
401 « authentification requise » sans jeton, 401 « session invalide ou expirée » avec la clé
publiable. Le comportement du bouton « Embellir » des devis est strictement inchangé :
`kind` absent = ancien prompt, mot pour mot.

**Vérification** : 235 contrôles au navigateur (13 nouveaux) et 24 sur le site vitrine
(3 nouveaux), tous verts.

### Ce qu'il ne faut pas casser

- `kind` absent dans la requête = prompt des devis. Ne pas inverser ce défaut : le bouton
  « Embellir » des devis passerait à un texte de portfolio sans que personne ne l'ait demandé.
- Les champs vides ne sont **pas** écrits dans le manifeste : le site s'appuie dessus pour ne
  rien afficher plutôt que d'afficher une étiquette vide.
- Le test du site parcourt la page jusqu'en bas avant de compter les photos : elles sont en
  chargement paresseux, et le texte de présentation les a poussées plus bas. Sans ce
  défilement, le test mesure le lazy-loading, pas le site.

### Non vérifié, et pourquoi

Le texte réellement produit par le modèle n'a **pas** été vu : il faut une session connectée
pour appeler la fonction, et cette session n'en a pas. Ce qui est vérifié : la requête part
avec les bons champs, la réponse revient dans le champ et dans la fiche, l'échec est lisible,
et la fonction déployée refuse bien tout appel non authentifié. **À faire à ton retour** :
cliquer « ✨ Rédiger un texte » sur une vraie réalisation et juger le texte. Si le ton ne va
pas, le prompt est dans `supabase/functions/embellish/index.ts`, branche `kind === 'realisation'`.

---

## 5 septembre 2026 — Un lien partagé qui ne s'affiche plus tout nu

**Branche** `claude/site-seo` → fusionnée sur `main`, site public déployé.
**Chantier** `si05` (moyenne) — pris en initiative parce qu'il ne demande **aucune action**
de ta part et qu'il change ce que voient les gens à qui Mélissa envoie le lien.

**Le problème, concret** : un lien vers le site envoyé sur WhatsApp ou Instagram
n'affichait ni image ni description. Les robots de ces services **ne lisent pas le
JavaScript** : ils ne voient que le HTML livré, qui n'avait qu'un titre.

**Ce qui est livré**

- **Image d'aperçu.** À chaque publication, le CRM dépose la couverture de la réalisation
  publiée à une **adresse fixe** (`galerie/<compte>/share.jpg`). La page publique cite cette
  adresse en dur : elle n'a donc jamais à être modifiée, et un lien partagé montre une vraie
  photo. Quand plus rien n'est en ligne, l'image est effacée — sinon un lien montrerait la
  photo d'un chantier qu'on vient justement de retirer du site.
- **Balises complètes** : og:url, og:site_name, og:locale, grande vignette Twitter, adresse
  canonique, données structurées schema.org. Rien d'affirmé qu'on ne sache pas : le nom du
  site, son adresse, sa langue, son objet.
- **Titre d'onglet et description qui suivent le projet ouvert**, et qui reviennent à ceux du
  site quand on referme (image d'aperçu comprise).
- **robots.txt et sitemap.xml** (XML validé, bon espace de noms).
- **Chargement** : vignettes au-delà des deux premières chargées à l'approche, décodage hors
  du fil principal, priorité haute sur la première photo d'un projet.

**Vérification** : 237 contrôles au navigateur (2 nouveaux) et 36 sur le site (14 nouveaux),
dont les balises telles que les lit un robot sans JavaScript, et `robots.txt` / `sitemap.xml`
réellement servis par un serveur.

### Ce qu'il ne faut pas casser

- L'adresse de l'image d'aperçu est écrite **à deux endroits** : `shareImagePath()` dans le
  CRM et la balise `og:image` de `site-vitrine/index.html`. Changer l'un oblige à changer
  l'autre — c'est dit en commentaire des deux côtés.
- L'écriture de l'image d'aperçu est enveloppée dans un `try` : elle ne doit **jamais** faire
  échouer une publication, la galerie étant déjà en ligne à ce moment-là.
- Le test du site relit les balises sur une **page fraîche** : après l'ouverture d'un projet,
  elles décrivent ce projet, pas le site.

### Ce qui reste hors de portée sans une action de ta part

- **Un aperçu par projet** dans WhatsApp. Il faudrait une page HTML par projet, donc un
  générateur qui republie le dépôt du site à chaque publication — c'est-à-dire un jeton
  GitHub à créer et à confier au CRM. Non fait volontairement : ça demande une manip et un
  secret de plus. L'aperçu actuel (image du dernier projet publié) couvre le cas courant.
- **Nom de domaine propre** (chantier `si06`) : achat à faire, ~12 €/an.

---

## 5 septembre 2026 — Catégories et filtre du site

**Branche** `claude/site-categories` → fusionnée sur `main`, site déployé.
**Chantier** `si02` (haute).

**Livré** : un champ « Catégorie » dans la fiche d'une réalisation — **libre**, avec sept
types de lieu proposés (Appartement, Maison, Bureau, Commerce, Restaurant, Hôtel, Espace
commun) auxquels s'ajoutent automatiquement ceux déjà tapés ailleurs. Aucun panneau de
réglages à ouvrir pour inventer une catégorie de plus : c'est un champ de texte avec des
propositions.

Sur le site, une **barre de filtres construite à partir de ce qui est publié** : décompte par
catégorie, case active marquée, et rien du tout tant qu'il n'y a pas au moins deux
catégories. Une catégorie qui disparaît du site disparaît du filtre — il n'y a aucune liste
à tenir à jour nulle part.

**Un piège évité, et testé** : ouvrir un projet depuis une liste filtrée doit ouvrir CE
projet, pas celui du même rang dans la liste complète.

**Vérification** : 242 contrôles au navigateur (5 nouveaux), 42 sur le site (6 nouveaux). Le
banc d'essai du site passe à trois projets et deux catégories — un filtre ne veut rien dire
en dessous.

### Décision prise à ta place (dis-moi si elle ne te va pas)

La catégorie est un **type de lieu** (Appartement, Bureau…) et reste distincte du **type de
mission** (Rénovation complète, Décoration…), déjà livré. Deux axes différents : on filtre
par lieu, on décrit par mission. Fusionner les deux aurait donné un filtre incohérent
(« Appartement » à côté de « Décoration »).

---

## 5 septembre 2026 — À propos, contact, et ce que le site dit de lui-même

**Branche** `claude/site-contact` → fusionnée sur `main`, site déployé.
**Chantier** `si04` (moyenne).

**Livré** : un panneau « ⚙ Le site public » dans l'onglet Réalisations — sous-titre, texte
« À propos », e-mail, téléphone/WhatsApp, Instagram. Sur le site, une section « À propos »
en bas de page avec les liens correspondants (WhatsApp au format international, Instagram
depuis un simple @nom).

**Le point important** : **tout est vide, et le reste**. Je n'ai inventé aucun texte et
recopié aucune coordonnée. Mettre une adresse ou un numéro sur une page publique est une
décision qui appartient à Mélissa :

- les coordonnées des devis ne sont **jamais** reprises automatiquement — un bouton le fait
  en un geste, et c'est ce geste qui vaut accord ;
- rien ne part en ligne tant qu'on n'a pas cliqué « Mettre à jour le site » ;
- l'écran dit à chaque étape ce qui est en ligne et ce qui ne l'est pas ;
- un champ vide ne s'affiche pas ; tout vide, la section n'existe pas.

Corriger une faute dans le texte n'oblige pas à republier un chantier : la mise à jour ne
touche que le bloc de présentation du manifeste.

**Vérification** : 253 contrôles au navigateur (11 nouveaux), 49 sur le site (7 nouveaux),
dont l'échec réseau qui doit dire que rien n'a changé en ligne.

### À toi de décider (rien ne presse, rien n'est cassé en attendant)

1. **Le texte « À propos »** : deux ou trois phrases sur Mélissa et sa façon de travailler.
   Le champ est prêt, la page l'affichera dès qu'il sera rempli.
2. **Les coordonnées publiques** : e-mail, numéro WhatsApp, Instagram. Le bouton « Reprendre
   les coordonnées du devis » les recopie en un clic si vous voulez les mêmes.
3. Rien d'autre. Aucun compte à créer, aucune clé, aucune dépense.

### Note de sécurité, dite franchement

L'adresse e-mail n'est pas écrite dans le HTML de la page : le lien est fabriqué au
chargement à partir du manifeste. Ça décourage les robots collecteurs ordinaires. Ça ne rend
pas l'adresse secrète pour autant — le manifeste est un fichier public. Si Mélissa ne veut
pas exposer son e-mail du tout, laisser le champ vide et ne mettre que WhatsApp.

---

## 5 septembre 2026 — Sauvegarde complète : les photos aussi

**Branche** `claude/infra-sauvegarde` → fusionnée sur `main`. **Chantier** `fi02` (haute).

**Le risque** : la sauvegarde JSON ne portait que les **vignettes**. Si le compte Supabase
disparaît, les photos en pleine définition disparaissent avec — c'est-à-dire le travail de
plusieurs chantiers.

**Livré** : « Sauvegarde complète (.zip) » dans le panneau Sauvegarde. Données + toutes les
photos en pleine définition + les versions IA, rangées **un dossier par réalisation**, noms
lisibles, avec un LISEZ-MOI dans l'archive. Le poids est annoncé avant de lancer (calculé sur
la taille moyenne réelle des fichiers), on peut n'en sauvegarder qu'une réalisation, on peut
interrompre, et le bilan liste ce qui manquait au lieu de se taire.

**Et le chemin du retour** : « Importer une sauvegarde complète » relit l'archive et remet
chaque photo à sa place (`photos/_index.json` fait le lien). Une archive recompressée par un
autre outil est refusée en disant pourquoi.

**Vérification** : 266 contrôles (14 nouveaux), dont **l'archive relue par `unzip`** — pas
seulement par notre propre code — et un aller-retour complet : tout effacer, réimporter,
retrouver la photo octet pour octet, version IA comprise.

### Ce qu'il ne faut pas casser

- `donneesSauvegarde()` (ce qu'on écrit) et `appliquerSauvegarde()` (ce qu'on relit) sont
  **uniques** et partagées par l'export JSON et l'archive complète. Deux copies auraient fini
  par diverger, et ça ne se voit qu'au moment où l'on restaure — trop tard.
- `readZip` n'accepte que la méthode « store », celle de `buildZip`. C'est volontaire : le
  message d'erreur oriente vers la bonne cause (« archive recompressée ») au lieu de rendre
  des octets faux.

---

## 5 septembre 2026 — Plein écran : balayage au doigt

**Branche** `claude/site-plein-ecran` → fusionnée, site déployé. **Initiative** (hors
tableau) : c'est le geste que fait tout le monde sur un téléphone, et il manquait.

Balayage horizontal pour changer de photo (franc et horizontal seulement : un glissement
vertical ne change rien), rang affiché « 3 / 12 » annoncé aussi aux lecteurs d'écran, et la
photo suivante préchargée pendant qu'on regarde celle-ci.

3 contrôles ajoutés, dont le balayage réel et le glissement vertical qui ne doit rien faire.

---

## Coordination avec l'autre session

Une autre session a ajouté pendant ce temps un **workflow de recopie automatique** de
`site-vitrine/` vers le dépôt du site (`.github/workflows/sync-site-vitrine.yml`). Il tourne
et il a réussi. Conséquence pour la suite : **ne plus recopier le site à la main** — pousser
sur `main` suffit, la recopie se fait toute seule. Mes recopies manuelles antérieures et
celle-ci écrivent le même contenu, il n'y a pas de conflit.

---

## 5 septembre 2026 — Le menu principal sur téléphone

**Branche** `claude/crm-menu-mobile` → fusionnée sur `main`. **Chantier** `qu01` (haute).

**Le problème, mesuré** : cinq onglets dans la barre du haut, qui passaient sur deux lignes.
À 375 px, la barre faisait 87 px de haut ; avec les boutons Réglages / Sauvegarde / Vue
bureau au-dessous, on perdait environ un cinquième de l'écran avant même de voir la première
information.

**Livré**, en dessous de 820 px (téléphone et tablette en portrait) :

- la navigation devient une **barre d'onglets fixe en bas**, sous le pouce, icône + libellé,
  onglet ouvert souligné ;
- « Vue bureau », « Réglages » et « Sauvegarde » passent derrière un bouton **« ⋯ »**, avec
  la **synchronisation** en plus — elle n'était atteignable que par une pastille de 10 px ;
- le nom de l'atelier se réduit plutôt que de pousser la pastille de synchro à la ligne.

**Résultat mesuré** : barre du haut à **56 px sur une seule ligne** (au lieu de 87), barre du
bas 48 px. Au-dessus de 820 px, **rien ne change** : barre du haut classique, pas de barre du
bas.

**Vérification** : 284 contrôles (18 nouveaux), à 375, 390, 768 et 1280 px.

### Deux pièges rencontrés, et la règle qui en sort

1. **Ordre des feuilles de style.** Les règles d'origine (`#split-toggle`, `.rz-selbar`)
   étaient écrites **après** ma requête média : à égalité de spécificité, la dernière gagne.
   D'où des sélecteurs volontairement plus forts (`.toolbar #split-toggle`,
   `#rz-body .rz-selbar`), avec le commentaire qui dit pourquoi. Ne pas les « simplifier ».
2. **La barre d'actions d'une sélection de photos** serait passée **sous** la barre
   d'onglets : le bouton « Supprimer » aurait été inatteignable. Elle remonte, et un test
   mesure qu'elle reste au-dessus.

### Si le résultat ne te plaît pas

Tout tient dans un seul bloc `@media (max-width:820px)` et un `<nav class="navbas">`.
Supprimer le bloc rend exactement l'ancien comportement.

---

## 5 septembre 2026 — Annuler et rétablir dans l'éditeur photo

**Branche** `claude/photo-annuler` → fusionnée sur `main`. **Chantier** `ph08` (moyenne).

Boutons ↩ Annuler / ↪ Rétablir, désactivés quand il n'y a rien à faire, plus Ctrl+Z et
Ctrl+Maj+Z sur ordinateur. Un nouveau réglage après un retour en arrière coupe la branche
« rétablir », comme partout ailleurs.

**Choix technique** : la pile garde des **états complets** de `photo.edit` (un objet
minuscule : dix nombres) plutôt que des différences. Plus simple, et surtout ça ne peut pas
dériver. Un état n'est empilé que lorsqu'un geste est **terminé** (curseur relâché), jamais à
chaque mouvement — sinon quarante crans pour un seul glissement.

**Ne pas casser** : le retour en arrière écrit **dans** l'objet `edit` existant
(`Object.assign`) au lieu de le remplacer. L'éditeur, la vignette et la publication pointent
tous sur cet objet ; le remplacer les laisserait sur un orphelin — c'est exactement le bug de
corruption déjà rencontré sur les fiches client.

**Vérification** : 8 contrôles, dont la coupure de branche et le raccourci clavier qui ne
fait plus rien une fois l'éditeur fermé (l'écouteur est retiré à la fermeture).

---

## 5 septembre 2026 — Le CRM rappelle, et relie

Deux chantiers courts, tous deux fusionnés sur `main`.

**`cr02` — « republier » ne s'oublie plus** (branche `claude/crm-republier`). La carte d'une
réalisation passe de « ● en ligne » à « ● à republier » dès qu'une photo a bougé depuis la
mise en ligne, et le **tableau de bord** — l'écran qu'on regarde en premier — porte une ligne
« À republier sur le site » avec le nombre de photos ; un clic ouvre la réalisation. La règle
est écrite une fois (`realisationARepublier`) et sert aux deux endroits.

**`cr03` — clients, réalisations et devis reliés dans les deux sens** (branche
`claude/crm-real-client`). Le champ « Client » d'une réalisation existait mais ne servait à
rien. Désormais : une carte « Réalisations » dans la fiche client (avec l'état de chacune, et
un bouton qui crée une réalisation déjà rattachée), et dans la fiche d'une réalisation des
raccourcis vers la fiche client et vers chacun de ses devis.

### Un bug trouvé en chemin, et corrigé

Un devis dont l'instantané manque (import partiel, sauvegarde d'une ancienne version) faisait
**disparaître toute la fiche client** : le calcul du total levait une exception au milieu du
rendu. Il s'affiche maintenant sans montant, avec la mention « contenu illisible », au lieu
de tout emporter. Trouvé parce qu'un test a fabriqué un devis minimal — c'est exactement le
genre de cas qu'un import mal terminé produit.

**Vérification** : 300 contrôles au total, 0 échec.

---

## 5 septembre 2026 — Recherche globale

**Branche** `claude/crm-recherche` → fusionnée sur `main`. **Chantier** `qu03` (moyenne).

Un bouton 🔍 dans la barre du haut (Ctrl+K sur ordinateur) ouvre une fenêtre avec un seul
champ, qui cherche **en même temps** dans les clients, les devis, les tâches et les
réalisations — **jusque dans les légendes des photos**. Plusieurs mots : tous doivent être
présents, dans n'importe quel ordre ; accents et majuscules ignorés. Résultats groupés par
nature, huit par groupe, avec le compte exact. Entrée ouvre le premier.

Ça couvre aussi une partie du chantier `cr04` (recherche dans les réalisations) : une
réalisation se retrouve par son titre, son lieu, sa catégorie, sa mission, son texte ou la
légende d'une de ses photos.

**Au passage** : la barre du haut passe en `nowrap` sur téléphone — c'est le nom de l'atelier
qui se raccourcit, pas la barre qui s'épaissit. Le bouton de recherche la faisait repasser à
deux lignes, et n'importe quel libellé un peu plus long l'aurait refait.

---

## Observation, pas un chantier : ce qui est déjà public

En parcourant l'aperçu d'un devis sur téléphone, j'ai revu ce qui y figure : adresse, numéro
de téléphone, e-mail, numéro de licence et compte Instagram de Mélissa. C'est **normal** —
ce sont les coordonnées professionnelles d'un devis. Mais elles sont **écrites en dur dans
`index.html`**, qui est servi publiquement par GitHub Pages : elles sont donc déjà lisibles
par n'importe qui, sans connexion.

Ce n'est pas une fuite (ce sont des coordonnées professionnelles, faites pour être données à
des clients) et **je n'ai rien changé**. Mais ça éclaire la décision du site vitrine : la
question n'est pas « ces informations peuvent-elles devenir publiques », elles le sont — la
question est de savoir si vous voulez qu'elles soient **mises en avant** sur la page publique.
Le panneau « ⚙ Le site public » attend votre choix, il ne présume de rien.

---

## 5 septembre 2026 — Une session qui démarre sait déjà où elle en est

**Branche** `claude/infra-hook-demarrage` → fusionnée sur `main`. **Chantier** `fi03`.

`.claude/hooks/session-start.sh` (+ `.claude/settings.json`) tourne au démarrage de chaque
session sur ce dépôt :

- il **installe Playwright** si besoin, et seulement dans l'environnement cloud — les tests
  sont prêts sans que personne y pense ;
- il **affiche l'état** : les trois documents qui font foi, l'adresse du tableau des
  chantiers, les dernières entrées du journal, les cinq derniers commits, le travail non
  commité s'il y en a, et les commandes exactes de vérification.

**Ce qu'il ne fait pas, volontairement** : donner des consignes. L'état se charge, les
instructions restent dans les fichiers versionnés — relus, et discutables. C'est exactement
la règle « la base porte l'état, les fichiers portent les instructions ».

Mode **synchrone** : la session démarre un peu plus tard, mais rien ne peut tourner avant que
les dépendances soient là. On peut passer en asynchrone si l'attente gêne.

**Effet à partir de maintenant** : toute session ouverte sur `main` en bénéficie.

---

## 5 septembre 2026 — Cadrage au doigt

**Branche** `claude/photo-recadrage-doigt` → fusionnée sur `main`. **Chantier** `ph07`.

On tire la photo pour choisir ce que le cadre garde, au lieu de viser un curseur. Le
déplacement se fait sur **l'axe qui a du jeu** (horizontal pour une photo paysage dans un
carré, vertical pour une portrait) : le calcul de cadrage n'en laisse qu'un libre, proposer
l'autre mentirait. En format libre, rien à déplacer, et la barre du haut annonce le geste
réellement disponible.

Le curseur « Position » **reste** : il donne la précision au pixel et fonctionne au clavier.
Ce n'est pas une redondance — c'est la même valeur avec deux façons de la régler, comme les
◀ ▶ à côté du glisser-déposer pour l'ordre des photos.

**Ne pas casser** : trois gestes se partagent la photo et ne doivent jamais coexister —
cadrage (onglet Cadrage, format imposé), comparateur avant/après (une version IA existe),
appui long (voir l'original). `edPaintHint()` dit lequel est actif ; il est appelé à chaque
changement d'onglet.

**Vérification** : 6 contrôles, dont le sens du déplacement, les bornes, et le fait qu'un
geste complet ne compte que pour un cran d'annulation.

### Ce que je n'ai pas fait, et pourquoi — `ph14` (file d'attente fal.ai)

Le pont appelle encore `fal.run` en mode synchrone. Je sais que la retouche en série rend ce
chantier plus urgent, et j'ai commencé à l'écrire — puis j'ai arrêté. **Je ne peux pas le
vérifier** : passer par la file demande d'observer les vraies réponses de fal (identifiant de
requête, URL de statut, URL de résultat), et chaque essai coûte un appel facturé sur le
compte de Mélissa. Livrer un chemin d'exécution non vérifié à la place d'un chemin qui
fonctionne, c'est risquer de casser la seule fonction qui vient d'être mise en service.

**Ce qu'il faut faire quand tu seras là** : lancer une retouche réelle en gardant les
journaux Supabase ouverts, relever la forme exacte des réponses de `queue.fal.run`, et je
branche la file dessus. En attendant : **rester en 2K**, ne pas passer en 4K.

> **Suite, le 5 septembre, par une autre session — le chantier est fait.** L'obstacle était
> réel mais contournable : fal publie, pour **chaque modèle**, un `openapi.json` qui décrit
> sa file (`https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=…` — le pont s'en sert
> déjà pour les réglages). Ce fichier donne `servers: [{url:"https://queue.fal.run"}]` et les
> quatre chemins (déposer, statut, résultat, annuler) avec le schéma `QueueStatus`. Il est
> **public et gratuit** : la forme exacte se relève sans lancer un seul appel facturé.
> Vérifié ainsi sur trois modèles. Ce qui reste non vérifié, et qui l'est dit : une exécution
> réelle chez fal. Voir l'entrée « La retouche passe par la file d'attente de fal ».


---

## 5 septembre 2026 — Le site prend la forme d'un portfolio

**Branche** `claude/site-mise-en-page` → fusionnée sur `main`. **Initiative** (hors tableau),
prise en regardant ce que font les portfolios d'architectes et de photographes.

- **Les photos verticales se mettent par deux**, les horizontales gardent la pleine largeur.
  Une porte-fenêtre en portrait faisait deux mètres de haut sur un écran d'ordinateur et
  cassait la lecture. Une seule colonne en dessous de 700 px. L'orientation vient des
  dimensions déjà publiées dans le manifeste — rien à saisir.
- **« Projet suivant »** en bas de chaque projet, et les flèches ← → du clavier. Un portfolio
  se parcourt de projet en projet ; il fallait remonter à la liste à chaque fois. Le suivant
  **respecte le filtre actif** : on reste dans la catégorie qu'on regarde.
- **Images plus légères** : la page propose au navigateur les **deux tailles déjà publiées**
  (700 px et 1600 px) et le laisse prendre la plus petite quand elle suffit. **Aucune image
  supplémentaire n'est produite** — pas un octet de stockage en plus, ce qui compte vu la
  jauge du plan gratuit.
- **Fondu à l'arrivée** des images au lieu d'un saut ; la case tient la place avant, rien ne
  bouge.
- Les **filtres disparaissent** quand un projet est ouvert : ils appartiennent à la liste.

**Vérification** : 60 contrôles sur le site (8 nouveaux), dont l'orientation reconnue, les
deux colonnes, les deux tailles proposées, et le projet suivant au clic comme au clavier.

### Ce que je n'ai PAS fait, et qui demanderait quelque chose de toi

- **Une image d'aperçu par projet** dans WhatsApp : il faudrait une page HTML par projet,
  donc un générateur qui republie le dépôt du site à chaque publication. Le jeton existe
  désormais (l'autre session l'a mis en place pour la recopie) — c'est faisable, mais ça
  change la nature du site et je préfère te le proposer plutôt que le décider.
- **Une image intermédiaire (1000 px)** : elle ferait gagner encore du poids sur les
  téléphones haute densité, mais coûterait +50 % de stockage par photo. Mauvais échange tant
  que le plan gratuit est à 1 Go.

---

## 5 septembre 2026 — Filtres dans la grille des réalisations

**Branche** `claude/crm-real-filtres` → fusionnée sur `main`. **Chantier** `cr04`, la partie
qui restait après la recherche globale.

Toutes / À republier / En ligne / Pas publiées, plus une case par catégorie, chacune avec son
décompte. **Le filtre n'apparaît qu'à partir de six réalisations** : en dessous, la grille se
parcourt à l'œil et un contrôle de plus ne sert à rien. Une case qui ne rapporterait rien
n'est pas proposée. « Nouvelle réalisation » disparaît tant qu'un filtre est actif, et un
filtre devenu vide se rouvre tout seul plutôt que de laisser un écran vide sans raison.

**Note** : la suite de tests est passée à 393 contrôles — l'autre session travaille en
parallèle sur le même fichier et y a ajouté les siens. Tout est vert.

---

## 5 septembre 2026 — Clavier, et un projet qui peut mener à un contact

**Branche** `claude/site-clavier-contact` → fusionnée, site déployé. **Initiative.**

- **Plein écran au clavier** : le focus va sur le bouton fermer à l'ouverture, la tabulation
  tourne à l'intérieur de la fenêtre, et à la fermeture il revient **sur la photo d'où l'on
  venait**. Avant, on tabulait dans la page invisible derrière et on se retrouvait renvoyé en
  haut. C'est du confort pour tout le monde et une nécessité pour qui n'utilise pas de souris.
- **En bas d'un projet** : « Un projet de ce genre ? écrivez-moi » — WhatsApp si un numéro
  est renseigné, sinon l'e-mail. **Elle n'apparaît que si des coordonnées ont été saisies
  depuis le CRM.** Tant que rien n'est rempli, la ligne n'existe pas. Mêmes coordonnées que
  la section « À propos » : une seule source, pas deux endroits à tenir à jour.

C'est ce qui manquait pour qu'un portfolio serve à quelque chose commercialement : le
visiteur qui aime un chantier est à un clic d'écrire, sans remonter la page.

**Vérification** : 65 contrôles sur le site (5 nouveaux).

---

## 5 septembre 2026 — Un test qui relie les deux moitiés

**Branche** `claude/test-bout-en-bout` → fusionnée sur `main`. **Initiative.**

**Le trou** : le test du CRM vérifiait ce qu'il écrit dans le manifeste ; le test du site
vérifiait ce qu'il sait lire — mais avec un manifeste **écrit à la main** au milieu. Les deux
pouvaient donc diverger sans que rien ne bronche : il suffisait qu'un champ soit renommé d'un
côté (`categorie` → `category`, `texte` → `description`) pour que le site cesse de l'afficher.
Le risque n'est pas théorique : deux sessions travaillent en parallèle sur ce dépôt.

**`tests/bout-en-bout.test.mjs`** fait publier une vraie réalisation par le CRM — deux photos,
une horizontale et une verticale — puis sert **le manifeste et les images réellement écrits**
dans le stockage, et ouvre le site dessus. Aucun fichier n'est écrit à la main.

Il vérifie que traversent bien la frontière : titre, année, lieu, surface, mission, catégorie,
texte de présentation, légende d'une photo, **orientation** (qui décide de la mise en page),
vignette de couverture, et ce que le CRM dit du studio (à propos, contact).

**12 contrôles, 0 échec.** Le test démarre son propre serveur ; il suffit d'avoir celui du CRM
sur le port 8899. Il est ajouté au mode d'emploi (`tests/README.md`) et au hook de démarrage.

---

## 5 septembre 2026 — L'aperçu d'un devis sur téléphone

**Branche** `claude/crm-apercu-zoom` → fusionnée sur `main`. **Chantier** `qu04`
(« signalé de longue date, jamais traité »).

La refonte du menu mobile avait déjà fait passer la barre du haut de deux lignes à une
(87 px → 56 px). Il restait qu'elle **reste collée** pendant qu'on lit un devis : une bande
de document en moins à chaque écran. En mode aperçu, sur téléphone, elle ne l'est plus. Elle
revient dès qu'on remonte, et redevient collée dès qu'on repasse au composeur ; la navigation
reste de toute façon en bas.

**Si ce n'était pas ça, le problème** : dis-le-moi, la description du chantier était courte
(« la barre de menu mange la vue quand on clique la moitié de l'écran ») et j'ai traité ce que
j'ai pu constater à l'écran.

---

## 6 septembre 2026 — Tout republier d'un coup, et un mensonge silencieux corrigé

**Branche** `claude/crm-republier-lot` → fusionnée sur `main`. **Initiative**, dans la suite
directe du rappel « à republier ».

Le tableau de bord disait « 2 réalisations à republier » et laissait ouvrir chaque fiche pour
recliquer « Publier ». Il porte maintenant le geste : **« 🌐 Tout republier (2) »** —
confirmation (nombre de réalisations et de photos), progression, interruption possible, et un
bilan qui reste affiché **là où le geste a été fait**. Un échec sur l'une n'arrête pas les
autres ; le bilan nomme laquelle et pourquoi.

### Le bug trouvé en écrivant le test d'échec — celui-là comptait

`publishRealisation` datait chaque photo comme « publiée » **dans la boucle d'envoi**, donc
**avant** l'écriture du manifeste. Si cette écriture échouait (coupure réseau, manifeste
illisible), les photos étaient marquées en ligne alors que **le site n'en savait rien** : la
réalisation affichait « ● en ligne », le rappel « à republier » disparaissait, et plus rien ne
signalait que le site était resté en arrière.

C'est exactement le mensonge silencieux que ce rappel existe pour empêcher — et il était dans
le code depuis la première version de la publication. Les dates ne sont désormais posées
**qu'après** l'écriture du manifeste. Un test le vérifie : une publication qui échoue laisse
bien sa réalisation « en attente ».

**Ne pas casser** : ne jamais remonter `p.publishedAt=…` dans la boucle d'envoi des photos.
Tant que le manifeste n'est pas écrit, rien n'est en ligne.

**Vérification** : 413 contrôles au navigateur (6 nouveaux), bout en bout inchangé.

---

## 6 septembre 2026 — Deux demi-échecs qui ne pouvaient pas se voir

**Branches** `claude/photo-remplacement-sur` et `claude/import-sans-orphelin` → fusionnées.
**Initiative** : après le bug de datation trouvé la veille, j'ai relu tout ce que j'avais
écrit qui **écrit plusieurs fichiers d'affilée sans transaction possible**. Deux cas.

**1. Remplacer une photo laissait un demi-échange.** Deux fichiers sont écrasés (la pleine
définition et la vignette). Si le second envoi échouait, on avait la **nouvelle photo en
grand et l'ancienne en vignette** — un état que rien n'affiche comme anormal. Les deux
fichiers écrasés sont maintenant gardés le temps de l'échange et **remis en place** si quoi
que ce soit échoue, et le message le dit : « remplacement annulé, la photo d'avant est
toujours en place ».

**2. Un import coupé laissait un fichier fantôme.** Même situation à l'import : si le second
envoi échouait, le premier restait dans le seau, **référencé par aucune photo** — invisible
dans l'appli, impossible à supprimer, et comptant quand même dans le quota. Sur un plan
plafonné à 1 Go, ces fantômes s'accumulent en silence, et c'est précisément ce que l'alerte
de saturation ne pourrait pas expliquer. Ce qui a été envoyé est maintenant effacé.

**Au passage** : une coupure réseau ne s'annonce plus comme un « fichier illisible ». Les
deux ne se corrigent pas de la même façon — l'un demande de réessayer, l'autre de convertir
le fichier.

**Vérification** : 418 contrôles (5 nouveaux), dont un envoi coupé à mi-chemin avec la photo
retrouvée octet pour octet, et le nombre de fichiers du stockage avant/après.

### La règle qui sort de ces trois bugs

Trois fois de suite, le même défaut : **l'état est mis à jour avant que l'effet soit
réellement acquis** (photos datées avant l'écriture du manifeste, fichiers échangés sans
retour possible, fichier envoyé sans nettoyage). À écrire dans les prochaines revues :
*rien ne se marque « fait » tant que la dernière écriture n'a pas réussi, et tout ce qui a
été écrit avant l'échec se nettoie.*

---

## 6 septembre 2026 — « Je vois rien » : ce que la page montrait vraiment

**Diagnostic d'abord.** Raphaël a rechargé le site et n'a rien vu. Le site n'était pas
cassé : la page servie est bien la dernière version (identique à l'octet près au dépôt),
le manifeste public répond 200, les six photos publiées aussi, et chargée dans un vrai
navigateur avec les **vraies données publiées**, elle affiche le projet « Bureau Sébastien »,
sa photo de couverture et les trois liens de contact. Capture à l'appui.

Ce qu'il ne voit pas, ce sont les **nouveautés** — et c'est normal : la seule réalisation
publiée date du 5 septembre au soir et ne porte aucune des informations que ces nouveautés
affichent. Pas de catégorie sur au moins deux projets → pas de filtres. Pas de légendes →
rien sous les photos. Un seul projet → pas de « projet suivant ». Pas de texte de
présentation, pas de texte « À propos », pas de thème choisi. **Tout cela n'apparaîtra
qu'après avoir rempli ces champs dans le CRM puis republié** (Réalisations → « Tout
republier »).

**Ce qui, en revanche, était un vrai défaut.** Entre l'ouverture de la page et l'arrivée du
manifeste, le site n'affichait **rien du tout** : ni cartes, ni message, ni signe d'activité.
Sur un téléphone en réseau lent ce silence dure plusieurs secondes et se lit comme une page
cassée — c'est exactement l'impression décrite. Trois **cartes d'attente** occupent
maintenant la place des vraies ; elles sont dans le HTML servi, donc peintes avant même que
le script tourne, et disparaissent au premier rendu réel.

**Et un défaut plus grave parce qu'invisible** : un manifeste introuvable et un portfolio
réellement vide affichaient le **même** message, « Bientôt en ligne ». Un visiteur arrivant
pendant une panne repartait en croyant qu'il n'y a rien à voir, et personne n'apprenait que
le site était muet. Les deux cas sont désormais distincts, et celui de la panne propose de
**réessayer** sur place. Une lecture qui ne répond pas s'arrête au bout de vingt secondes,
sinon rien ne déclencherait jamais ce message.

**Au passage** : le banc d'essai éprouvait le cas « vide » avec un manifeste absent —
c'est-à-dire le cas de la panne, pas celui du portfolio vide. Il porte maintenant les deux
pages séparément, et le test aurait donc échoué à repérer le problème.

**Vérification** : 82 contrôles sur le site (10 nouveaux), 20 bout en bout, tous verts ;
puis la page réelle rechargée avec le manifeste et les photos réellement publiés — un
projet affiché, aucune erreur JavaScript. Déploiement confirmé en ligne.

**Ce qui demande une manipulation de sa part** : remplir lieu / surface / mission /
catégorie / texte sur « Bureau Sébastien », choisir un thème dans « Le site public »,
écrire le texte « À propos », puis republier. Sans ça, la moitié du travail de ces deux
jours reste invisible.
