# Journal de bord — sessions autonomes

Ce fichier est tenu par les sessions Claude qui travaillent seules sur le dépôt. Il dit
**où en est le travail**, pas comment travailler (ça, c'est `CLAUDE.md`). Le détail
technique de chaque chantier reste dans `PROJECT_LOG.md` ; ici, on tient le fil.

Source de vérité de ce qui reste à faire : le **tableau des chantiers**
<https://claude.ai/code/artifact/c7ead2fa-509a-4bf4-a2c5-ac18a5063d84>

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

**Vérification** : `tests/realisations.test.mjs` → **253 contrôles, 0 échec** (46 nouveaux) ;
`tests/pont-ia.test.mjs` → **20, 0 échec** (12 nouveaux) ; `tests/site.test.mjs` → 22, 0
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
