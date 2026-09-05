# Journal de bord — sessions autonomes

Ce fichier est tenu par les sessions Claude qui travaillent seules sur le dépôt. Il dit
**où en est le travail**, pas comment travailler (ça, c'est `CLAUDE.md`). Le détail
technique de chaque chantier reste dans `PROJECT_LOG.md` ; ici, on tient le fil.

Source de vérité de ce qui reste à faire : le **tableau des chantiers**
<https://claude.ai/code/artifact/c7ead2fa-509a-4bf4-a2c5-ac18a5063d84>

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
