# PROJECT_LOG.md

Journal des chantiers sur ce dépôt (CRM + générateur de devis, single-file `index.html`, hébergé sur GitHub Pages, sync via Supabase). Une section par chantier, mise à jour aux étapes importantes — pas un historique de chaque message. Chaque section a une liste "Notes / À faire" : cases cochées [x] = déjà fait, non cochées [ ] = pas encore traité.

## Authentification & synchronisation cloud

**État** : connexion à un compte obligatoire. Le bouton "Continuer hors ligne" (mode anonyme, données locales uniquement) a été retiré de l'UI — c'est ce mode qui a causé une vraie perte de données quand l'utilisatrice a vidé le cache du navigateur. `loginOffline()` reste en JS pour les tests automatisés uniquement, jamais exposée dans l'UI de production.

Bug corrigé dans `cloudPush()` : un push qui échouait (hors ligne, erreur réseau) marquait quand même la donnée comme "synchronisée" en interne côté client, donc plus jamais retentée — un rechargement pouvait alors écraser silencieusement la modification locale non envoyée. Le marquage n'a lieu qu'après confirmation d'écriture réussie. Retry auto sur l'évènement `online` du navigateur + filet de sécurité toutes les 20s tant qu'une erreur persiste.

**Ne pas casser** : ne jamais réintroduire de mode de stockage purement local non lié à un compte dans l'UI de production. Toute nouvelle donnée utilisateur (nouveau champ, nouvelle collection) doit être synchronisée au même titre que `clients`/`devis`/`library`/`tasks` (voir `SYNC_KEYS`).

**Notes / À faire**
- [x] Retirer le mode "Continuer hors ligne" de l'UI (connexion à un compte obligatoire).
- [x] Corriger le marquage "synchronisé" à tort sur un push qui a échoué.
- [x] Retry automatique de la synchro (évènement `online` + filet 20s).
- [ ] Parcours d'inscription self-service (voir section Commercialisation).

## Sauvegarde automatique (exports/imports + panneaux)

**État** : `exportData()`/`importData()` (bouton Sauvegarde) couvrent désormais aussi les tâches et leurs pièces jointes — ils ne couvraient avant que clients/devis/bibliothèque.

Les 5 panneaux qui ne persistaient qu'au clic explicite sur "Enregistrer" (Bibliothèque de services, CGV, catégories de chantier, catégories de tâches, Réglages/branding) sauvegardent maintenant automatiquement à chaque modification (debounce 500ms), via `saveLibraryDebounced()`. Fermer un panneau par la croix ne perd plus rien.

**Ne pas casser** : toute nouvelle donnée saisie manuellement par l'utilisateur doit être persistée automatiquement, jamais dépendante d'un unique clic "Enregistrer" final. Les boutons "Enregistrer" existants sont gardés pour la confirmation visuelle (toast) mais ne doivent pas être le seul chemin de sauvegarde.

**Notes / À faire**
- [x] Inclure les tâches (+ pièces jointes) dans l'export/import de sauvegarde.
- [x] Sauvegarde auto sur les 5 panneaux Bibliothèque/CGV/catégories chantier/catégories tâches/Réglages.

## Bibliothèque (`library`) — un objet partagé, fragile aux resets larges

**État** : `resetLibrary()` (bouton "↺ Services fournis") remplaçait tout l'objet `library` par un objet par défaut, effaçant au passage branding, bibliothèque de fonds, catégories de tâches/chantier et CGV — cause confirmée d'une perte de la bibliothèque de fonds signalée par l'utilisatrice. Corrigé : ne réinitialise plus que `sections`/`exclus`.

**Ne pas casser** : `library` porte de nombreuses sous-fonctionnalités indépendantes (`branding`, `bgLibrary`, `taskCategories`, `chantierCats`, `cgv`, `sections`, `exclus`). Un reset ciblé sur l'une d'elles ne doit **jamais** faire `library = defaultLibrary()` ou équivalent — ne reset que les clés concernées.

**Notes / À faire**
- [x] Corriger `resetLibrary()` pour ne toucher que `sections`/`exclus`.

## Devis — éditeur & aperçu

**État** :
- Aperçu (`.devis`) en largeur fluide (max 1100px) au lieu d'une largeur fixe 210mm centrée avec grand vide gris autour — le rendu print/PDF garde le vrai format A4, inchangé.
- Scroll indépendant éditeur/aperçu (pour que le scroll-sync vers une section ne sorte pas le champ édité de la vue) **scopé à `body.devis-active`** — appliqué sans condition, ça figeait aussi le Tableau de bord/Clients/Estimation sur écran ≥901px (tablette), plus moyen de scroller. Même correction appliquée au toggle manuel "Vue bureau" (`body.force-split`).
- Section Client en deux colonnes (Raison sociale/Contact/Téléphone/Email à gauche, Adresse/N° société/Ville/Code postal à droite), actives dès 601px.
- Signature : case "Signataire différent de la raison sociale (personne physique)" avec champ dédié ; blocs signature (nous/client) en deux colonnes de largeur égale.
- Deux cases indépendantes : signer à la fin du devis / signer en bas des CGV.
- Bibliothèque de fonds (textures) : ajout direct sans passer par le fond actif, réapplicable, supprimable.
- 8 boutons d'action regroupés en 2 colonnes logiques (Gérer le devis / Produire & envoyer) avec icônes, dont un bouton WhatsApp (wa.me, indicatif 972 déduit pour les numéros locaux en 0).

**Ne pas casser** : le rendu print (`@media print`) doit rester en vrai format A4 — toute modif de `.devis`/`.devis-page` doit être vérifiée séparément en aperçu écran et en impression/export PDF.

**Notes / À faire**
- [x] Aperçu devis plein largeur au lieu du grand vide gris.
- [x] Corriger le scroll figé sur tablette/vue bureau (scope `body.devis-active`).
- [x] Section Client en deux colonnes.
- [x] Signataire modulable (personne physique différente de la raison sociale).
- [x] Cases signature fin de devis / fin des CGV.
- [x] Bibliothèque de fonds (ajout direct, réapplication, suppression).
- [x] Boutons d'action regroupés + bouton WhatsApp.
- [ ] Aperçu devis "zoomé" façon vue à 200% quand on clique la moitié de l'écran (barre de menu qui mange la vue) — signalé, pas encore traité.

## Tableau de bord — tâches

**État** : page d'atterrissage par défaut de l'app (avant : Devis — changé car les tâches/relances sont consultées quotidiennement, le devis non). Tâches : 6 niveaux de priorité (En attente/Faible/Normal/Important/Urgent/Critique, icônes dédiées), catégories métier éditables avec icônes (8 par défaut), accordéon inline (pas de modale), pièces jointes, tri en un seul menu déroulant compact (critère + sens combinés) — le filtre par pastilles multi-sélection façon page Clients a été essayé puis retiré (jugé trop envahissant sur mobile).

**Ne pas casser** : `input[type=date]` doit rester dans le sélecteur CSS de base qui donne `width:100%` (oubli déjà survenu, causait un désalignement avec les `<select>` voisins).

**Notes / À faire**
- [x] Liste de tâches sur le tableau de bord (titre, détail, échéance, rappel, priorité).
- [x] Accordéon inline au lieu d'une modale par tâche.
- [x] Pièces jointes sur les tâches.
- [x] Catégories de tâches éditables avec icônes.
- [x] Niveau de priorité "Important".
- [x] Tri compact (critère + sens en un seul menu).
- [x] Tableau de bord comme page d'atterrissage par défaut.

## Responsive mobile/tablette

**État** : plusieurs bugs de débordement corrigés au fil de l'eau (`row3` sans règle mobile, `word-break` global qui cassait les mots courts des boutons — corrigé en le limitant au `textarea`, `input[type=date]` hors du style de base, scroll figé ≥901px scopé à la vue Devis).

**Ne pas casser** : toute règle CSS visant à corriger un débordement doit être testée à la fois sur mobile étroit (~375px) et tablette (~800-1024px) — plusieurs correctifs ont eu des effets de bord sur l'autre format.

**Notes / À faire**
- [x] Fix débordement `row3` (Échéance/Rappel/Priorité) sur mobile.
- [x] Limiter `word-break` au `textarea` (cassait les boutons du menu).
- [x] `input[type=date]` dans le style de base (désaligné sinon).
- [x] Scroll figé sur tablette (Tableau de bord et vue bureau).
- [ ] Réorganisation du menu principal (barre du haut) en version mobile — pas encore traité.

## i18n & commercialisation

**État** : discuté, rien commencé côté code. Infra multi-comptes (Supabase/RLS) déjà en place — chaque compte a ses propres données — mais pas de parcours d'inscription self-service dans l'app (seule la connexion à un compte existant fonctionne).

**Notes / À faire**
- [ ] Traduction anglais (UI + devis).
- [ ] Traduction hébreu RTL.
- [ ] Langue de l'UI et langue du devis indépendantes l'une de l'autre.
- [ ] Parcours d'inscription self-service (actuellement, un compte doit être créé manuellement côté Supabase).

## Nettoyage de code

**État** : passe de nettoyage effectuée une fois (code mort supprimé — dont des données clients réelles codées en dur —, CSS dupliqué fusionné, `pickImageFile()` factorisé pour les 7 imports d'image).

**Notes / À faire**
- [x] Nettoyage code mort + CSS dupliqué + factorisation import image.
- [ ] Repasser dessus périodiquement si le fichier continue de grossir.
