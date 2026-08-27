# PROJECT_LOG.md

Journal des chantiers sur ce dépôt (CRM + générateur de devis, single-file `index.html`, hébergé sur GitHub Pages, sync via Supabase). Une section par chantier, mise à jour aux étapes importantes — pas un historique de chaque message.

## Authentification & synchronisation cloud

**État** : connexion à un compte obligatoire. Le bouton "Continuer hors ligne" (mode anonyme, données locales uniquement) a été retiré de l'UI — c'est ce mode qui a causé une vraie perte de données quand l'utilisatrice a vidé le cache du navigateur. `loginOffline()` reste en JS pour les tests automatisés uniquement, jamais exposée dans l'UI de production.

Bug corrigé dans `cloudPush()` : un push qui échouait (hors ligne, erreur réseau) marquait quand même la donnée comme "synchronisée" en interne côté client, donc plus jamais retentée — un rechargement pouvait alors écraser silencieusement la modification locale non envoyée. Le marquage n'a lieu qu'après confirmation d'écriture réussie. Retry auto sur l'évènement `online` du navigateur + filet de sécurité toutes les 20s tant qu'une erreur persiste.

**Ne pas casser** : ne jamais réintroduire de mode de stockage purement local non lié à un compte dans l'UI de production. Toute nouvelle donnée utilisateur (nouveau champ, nouvelle collection) doit être synchronisée au même titre que `clients`/`devis`/`library`/`tasks` (voir `SYNC_KEYS`).

## Sauvegarde automatique (exports/imports + panneaux)

**État** : `exportData()`/`importData()` (bouton Sauvegarde) couvrent désormais aussi les tâches et leurs pièces jointes — ils ne couvraient avant que clients/devis/bibliothèque.

Les 5 panneaux qui ne persistaient qu'au clic explicite sur "Enregistrer" (Bibliothèque de services, CGV, catégories de chantier, catégories de tâches, Réglages/branding) sauvegardent maintenant automatiquement à chaque modification (debounce 500ms), via `saveLibraryDebounced()`. Fermer un panneau par la croix ne perd plus rien.

**Ne pas casser** : toute nouvelle donnée saisie manuellement par l'utilisateur doit être persistée automatiquement, jamais dépendante d'un unique clic "Enregistrer" final. Les boutons "Enregistrer" existants sont gardés pour la confirmation visuelle (toast) mais ne doivent pas être le seul chemin de sauvegarde.

## Bibliothèque (`library`) — un objet partagé, fragile aux resets larges

**État** : `resetLibrary()` (bouton "↺ Services fournis") remplaçait tout l'objet `library` par un objet par défaut, effaçant au passage branding, bibliothèque de fonds, catégories de tâches/chantier et CGV — cause confirmée d'une perte de la bibliothèque de fonds signalée par l'utilisatrice. Corrigé : ne réinitialise plus que `sections`/`exclus`.

**Ne pas casser** : `library` porte de nombreuses sous-fonctionnalités indépendantes (`branding`, `bgLibrary`, `taskCategories`, `chantierCats`, `cgv`, `sections`, `exclus`). Un reset ciblé sur l'une d'elles ne doit **jamais** faire `library = defaultLibrary()` ou équivalent — ne reset que les clés concernées.

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

## Tableau de bord — tâches

**État** : page d'atterrissage par défaut de l'app (avant : Devis — changé car les tâches/relances sont consultées quotidiennement, le devis non). Tâches : 6 niveaux de priorité (En attente/Faible/Normal/Important/Urgent/Critique, icônes dédiées), catégories métier éditables avec icônes (8 par défaut), accordéon inline (pas de modale), pièces jointes, tri en un seul menu déroulant compact (critère + sens combinés) — le filtre par pastilles multi-sélection façon page Clients a été essayé puis retiré (jugé trop envahissant sur mobile).

**Ne pas casser** : `input[type=date]` doit rester dans le sélecteur CSS de base qui donne `width:100%` (oubli déjà survenu, causait un désalignement avec les `<select>` voisins).

## Responsive mobile/tablette

**État** : plusieurs bugs de débordement corrigés au fil de l'eau (voir historique git pour le détail : `row3` sans règle mobile, `word-break` global qui cassait les mots courts des boutons — corrigé en le limitant au `textarea`, `input[type=date]` hors du style de base). Sujet du menu principal (barre du haut) qui se réorganise mal en version mobile : **différé**, pas encore traité.

**Ne pas casser** : toute règle CSS visant à corriger un débordement doit être testée à la fois sur mobile étroit (~375px) et tablette (~800-1024px) — plusieurs correctifs ont eu des effets de bord sur l'autre format.

## Sujets différés / notes

- Réorganisation du menu principal mobile (barre du haut) — pas encore traité.
- i18n (anglais puis hébreu RTL) — recommandations discutées, pas commencé.
- Commercialisation multi-comptes — infra Supabase/RLS déjà en place (chaque compte a ses propres données), mais pas de parcours d'inscription self-service dans l'app à ce jour (seule la connexion à un compte existant est possible).
- Nettoyage de code effectué une fois (code mort supprimé, `pickImageFile()` factorisé) — à refaire périodiquement si le fichier continue de grossir.
