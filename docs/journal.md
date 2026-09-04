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
- Le **site vitrine vit dans un dépôt séparé** (`rnab26/melissa-nabet-site`) : les légendes
  s'affichent une fois `site-vitrine/index.html` recopié là-bas. Voir « À faire côté
  Raphaël » ci-dessous.

### À faire côté Raphaël

1. **Reporter le site vitrine dans son dépôt.** Le fichier `site-vitrine/index.html` de ce
   dépôt est la source ; c'est lui qu'il faut copier dans `rnab26/melissa-nabet-site`
   (fichier `index.html`) pour que les légendes apparaissent sur la page publique. Tant que
   ce n'est pas fait, les légendes sont bien publiées dans le manifeste mais la page ne les
   affiche pas — rien n'est cassé, elles sont simplement invisibles.
   *(Cette session n'a accès qu'au dépôt du CRM.)*
2. Rien d'autre. Le reste est en ligne dès que GitHub Pages a fini de déployer `main`.

