# Journal de bord — sessions autonomes

Ce fichier est tenu par les sessions Claude qui travaillent seules sur le dépôt. Il dit
**où en est le travail**, pas comment travailler (ça, c'est `CLAUDE.md`). Le détail
technique de chaque chantier reste dans `PROJECT_LOG.md` ; ici, on tient le fil.

Source de vérité de ce qui reste à faire : le **tableau des chantiers**
<https://claude.ai/code/artifact/c7ead2fa-509a-4bf4-a2c5-ac18a5063d84>

---

## 6 septembre 2026 — Identité « index » du site vitrine, et des rubriques qui se gèrent depuis le CRM

**Branche** `claude/site-identite-index-0509`. **Chantier** `eaf36cf0-9664-45ed-b536-a7f861a489ee`.
**Fiche de décision** <https://claude.ai/code/artifact/0a5981ec-e66c-4ec9-86dd-500d76843969>
(collection `reponses`, document `site-theme`) — c'est elle qui fait foi sur les choix ci-dessous.

### Ce qui a été demandé

Direction retenue : **« index »** (liste typographique, EB Garamond + Jost, fond clair,
vignette sous le nom), accueil en **grille**, mouvement **discret**, langues **fr / en / he**,
sections **réalisations, studio, contact, journal**. Et cette phrase, qui est la vraie
exigence : *« il y a une section par thème […] commercial, habitation, bureaux, réalisation
sur mesures. Le site doit être facilement modulable avec la même logique, j'applique pour
tous mes projets et chantiers. »*

### La décision structurante

Les rubriques **ne sont pas écrites dans le HTML du site**. Elles vivent dans
`library.site.categories` côté CRM, partent dans le manifeste, et le site les lit dans
l'ordre reçu. Ajouter « Hôtellerie » dans les réglages la fait apparaître en ligne sans
qu'une ligne de code soit touchée. C'est le point à ne pas casser : dès qu'on écrira une
catégorie en dur quelque part, la promesse « modulable » tombe.

Même logique pour tout le reste du contenu non-photo : nom, sous-titre, texte du Studio,
Contact, entrées du Journal, langues proposées — tout est dans les réglages, tout part dans
le manifeste, rien n'est en dur.

### Livré côté CRM (`index.html`)

- **Réalisations → « ⚙ Réglages du site »** : panneau unique avec onglets de langue
  (une seule langue affichée à la fois — trois colonnes de texte sur un téléphone sont
  illisibles). Identité, rubriques, Studio, Journal, Contact, langues proposées.
- **Rubriques** : ajouter, renommer, réordonner (↑ ↓), supprimer avec confirmation qui
  annonce combien de réalisations sont concernées. Une suppression ne perd aucune
  réalisation : elle repasse « sans rubrique ».
- **Fiche d'une réalisation** : nouveau champ « Rubrique du site », alimenté par cette liste.
- **« Mettre le site à jour »** : réécrit le manifeste — réglages **et** nom/date/rubrique des
  réalisations déjà en ligne — **sans retoucher une seule photo**. Republier une réalisation
  refait le rendu de toutes ses images : c'était inacceptable pour un simple changement de
  rubrique. Succès et échec s'affichent dans le panneau (le message reste), pas seulement en
  toast qui disparaît.

### Livré côté site (`site-vitrine/index.html`, réécrit)

- **Identité « index »** : EB Garamond sur les noms, Jost sur l'appareil de lecture, fond
  clair, **le nom du projet au-dessus de sa vignette** (vérifié par mesure : 318 px contre
  376 px), rubriques numérotées `01 · Commercial` avec filet.
- **Grille** par rubrique, une colonne pleine largeur sur téléphone.
- **Mouvement discret** : apparition de quelques pixels à l'entrée dans l'écran, agrandissement
  de 2,8 % de la vignette au survol, filet qui se trace sous le nom. `prefers-reduced-motion`
  coupe tout.
- **Sections Studio / Journal / Contact** dans l'ordre choisi, **masquées tant qu'elles sont
  vides** — pas d'onglet « Journal » qui ouvre sur du néant.
- **États** : squelette au chargement, « Bientôt en ligne » quand rien n'est publié, message
  de panne **avec bouton Réessayer** quand le manifeste ne se charge pas (avant, les deux cas
  donnaient le même message : une panne réseau se faisait passer pour un site vide).
- Un projet **sans rubrique** reste visible, rangé en fin d'index sous « Autres réalisations ».

### Les trois langues : mécanique livrée, textes en attente

Sélecteur FR / EN / עב, choix retenu d'une visite à l'autre, hébreu en **lecture de droite à
gauche** (mise en page en miroir, flèches du plein écran inversées). L'**interface** est
traduite dans les trois langues — ce sont des mots d'appareil (navigation, états, boutons).

Les **textes de Melissa** ne le sont pas et ne le seront pas automatiquement : tant qu'une
traduction manque, c'est le **français d'origine** qui s'affiche. Poser une traduction
automatique sous son nom n'était pas une option. Le panneau du CRM signale, langue par
langue, ce qui n'est pas encore traduit.

### Décisions prises seul, faute de pouvoir demander

- **« index » + accueil « grille »** semblaient se contredire (la maquette C était une liste).
  Réconciliés ainsi : registre typographique de l'index — le nom d'abord, l'image ensuite —
  mais disposés en grille. Les deux réponses sont respectées.
- **Journal** : il l'a choisi alors qu'aucune des cinq références (Chipperfield, Studio KO,
  Norm, Van Duysen, Yovanovitch) n'a de blog. Sa réponse l'emporte, mais la section reste
  masquée tant qu'aucune entrée n'est écrite.
- **Langue par défaut** : français, sans détection du navigateur. Détecter l'anglais afficherait
  une interface anglaise sur des textes français — ça a l'air cassé.
- **Aucun formulaire de contact** : aucune des cinq références n'en a. E-mail, téléphone,
  ville, Instagram, et c'est tout.

### Vérification

Tout au navigateur, Chromium réel, rien de déduit :

- `tests/site.test.mjs` — **46 contrôles, 0 échec.** Site public réécrit : rubriques, sections,
  trois langues, RTL, états, 390 px. Manifeste d'essai avec quatre réalisations, une rubrique
  sans projet et une réalisation sans rubrique.
- `tests/reglages-site.test.mjs` — **nouveau, 18 contrôles, 0 échec.** Le panneau du CRM, de la
  création d'une rubrique jusqu'à sa présence dans le manifeste, en 390 px.
- `tests/realisations.test.mjs` — **222 contrôles, 0 échec.** Aucune régression sur l'existant.
- Captures : `/tmp/site-mobile.png`, `/tmp/site-desktop.png`, `/tmp/site-hebreu.png`,
  `/tmp/crm-reglages-390.png`.

### Trois défauts trouvés et corrigés en cours de route

1. **Le choix de langue ne tenait pas.** La page s'affiche avant que le manifeste soit arrivé,
   donc en français faute de mieux — et elle **écrivait** ce français dans le stockage local,
   effaçant le choix de la visite précédente. Un repli technique ne s'enregistre plus, seul un
   choix explicite le fait.
2. **Le squelette de chargement restait affiché** sous l'index, pour toujours : masqué par
   l'attribut `hidden`, mais son `display:grid` l'emportait sur le `display:none` du
   navigateur. Trouvé à l'œil sur la capture, pas par un test — d'où le contrôle ajouté depuis.
   Un `[hidden]{display:none!important}` couvre maintenant tous les blocs masqués de la page.
3. **`input[type=tel]` manquait** dans la règle CSS des champs du CRM : le champ Téléphone
   gardait sa largeur native et débordait de l'écran d'un téléphone. Corrigé à la racine,
   c'est le seul champ `tel` du dépôt.

### Ce qu'il ne faut pas casser

- `siteManifestBlock()` est **la** source du bloc `site` du manifeste. `emptyManifest()`,
  `publishRealisation()` et `publishSiteSettings()` passent tous par elle : ne pas
  reconstruire ce bloc ailleurs, les trois chemins divergeraient en silence.
- Le site ne connaît **aucune** catégorie en dur. Il lit `site.categories`. Un projet dont la
  catégorie n'existe plus doit rester visible (il retombe en fin d'index) — c'est le cas que
  le test `Un projet sans rubrique reste visible` protège.
- Les champs vides ne partent pas dans le manifeste (`siteI18n`) : le site sait retomber sur
  le français, une chaîne vide publiée l'en empêcherait.
- `normalizeRealisation` doit garder `category` dans ses valeurs par défaut, sinon la rubrique
  est perdue à chaque synchronisation.

### Ce qui reste, et qu'il faut lui dire

1. **Une seule réalisation en ligne.** Aucune identité ne donnera l'effet d'un site de studio
   avec une photo. Les cinq références reposent sur dix projets et de grandes images.
2. **Trois langues = trois fois le texte à écrire.** La mécanique est là, le français est
   rempli, l'anglais et l'hébreu attendent ses mots.

---

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
