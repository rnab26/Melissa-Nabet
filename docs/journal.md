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
**308 contrôles au navigateur, 52 sur le site public, 8 sur le pont IA — 0 échec.**

## Ce qui a changé, par ordre d'importance pour toi

| | Ce que tu pourras faire à l'ouverture |
|---|---|
| **Galerie** | Ranger les photos (glisser-déposer à la souris, ◀ ▶ au doigt), les **renommer et les légender**, **remplacer** une photo sans perdre sa place, voir la **progression d'un import** et la raison exacte de chaque fichier refusé (HEIC d'iPhone compris). Menu ⋯ par vignette, ◀ ▶ dans l'éditeur. |
| **Retouche IA** | Une consigne, **toute la série** : coût annoncé avant, plafond qui bloque, interruption possible, bilan des échecs. |
| **Éditeur** | **Annuler / Rétablir** (et Ctrl+Z). |
| **Site public** | Fiche de projet avec **lieu, surface, mission, texte de présentation** ; **filtre par catégorie** ; **section À propos et contact** (vide, elle t'attend) ; **aperçu correct quand on partage le lien** sur WhatsApp ; balayage au doigt en plein écran. |
| **Téléphone** | Le menu principal passe **en bas**, la barre du haut ne fait plus qu'une ligne : ~115 px d'écran regagnés. |
| **Sécurité des données** | **Sauvegarde complète (.zip)** avec les photos en pleine définition, et le **retour en arrière** qui les remet en place. **Alerte** quand le stockage se remplit. |
| **Au quotidien** | **Recherche globale** (Ctrl+K) sur tout le CRM, jusque dans les légendes. Rappel **« à republier »** sur le tableau de bord. Clients ↔ réalisations ↔ devis enfin **reliés dans les deux sens**. |

## Ce qui t'attend, et rien d'autre

1. **Écrire le texte « À propos »** et choisir les coordonnées publiques du site
   (onglet Réalisations → « ⚙ Le site public »). Livré **vide** : je n'invente pas de
   contenu à la place de Mélissa.
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

