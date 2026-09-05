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
- [x] Boutons d'action (Gérer le devis / Produire & envoyer) recompactés en 2 colonnes même sur mobile étroit (au lieu d'un empilement en 8 lignes).
- [x] Onglets Composer/Aperçu retirés de la barre du haut → bouton flottant unique en bas d'écran (mobile/tablette uniquement, masqué en Vue bureau).
- [x] Nav "Devis" transformée en menu déroulant (Composer / Mes devis) — l'ancien bouton "Composer" ne servait à rien une fois déjà sur le composeur.
- [x] Sections de services repliées par défaut à chaque ouverture (nouveau devis, devis existant rechargé, ou rechargement de la page) — restaient ouvertes tant qu'on ne fermait pas manuellement, remplissant toute la page.
- [x] Fond de l'aperçu (papier) qui s'arrêtait au milieu d'un devis long (2 pages+) en bureau/Vue bureau — `.devis` (flex item de `.preview-wrap`) plafonnait à sa `min-height` (une page) au lieu de grandir avec le contenu réel ; fix `align-self:flex-start`.
- [x] Bouton flottant Aperçu recentré (bas d'écran, horizontalement centré) et agrandi pour être plus visible/facile à toucher.

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
- [x] Vraie case à cocher pour valider une tâche (au lieu de cliquer sur l'icône de priorité, jugé pas assez intuitif).
- [x] Bloc "Archives" replié en bas de la liste (tâches faites), dépliable, réactivation possible (recocher la case ramène la tâche dans la liste active).
- [x] Filtre d'affichage séparé du tri (menu "Affichage" : toutes / avec échéance / avec rappel / par catégorie), en plus du menu "Tri" existant — les deux se combinent.
- [x] Filtre revu en menu déroulant à cases à cocher multi-sélection (catégories en union entre elles, échéance/rappel en ET par-dessus) — la V1 en deux menus déroulants séparés ne correspondait pas à la demande.
- [x] Tri redécomposé en menu (critère) + bouton ↑/↓ séparé (au lieu du menu combiné critère+sens).
- [x] Bouton "⚙ Catégories" remonté à côté du titre "Mes tâches" (réglage, pas un filtre).
- [x] V3 filtre : refait en "tableau" à 4 colonnes (Échéance / Rappel / Catégorie / Priorité) dans le menu déroulant unique "🔍 Filtrer" — priorité ajoutée comme axe de filtre (n'existait qu'en tri avant). Barre de contrôle sur une seule ligne : "+ Nouvelle tâche" à gauche, Filtrer + Ordre (↑/↓) au centre, "⚙ Catégories" à droite.
- [x] Tri simplifié à un seul critère fixe (priorité puis échéance) + bouton ↑/↓ unique — plus de sélecteur de critère séparé (demande explicite de simplification).
- [x] Horodatage de fin de tâche (`completedAt`) : affiché en tag "✓ Terminée le {date} à {heure}" sur la tâche archivée — sert de garde-fou si elle a été cochée par erreur. Les archives sont triées par date de complétion la plus récente en premier (indépendamment du tri de la liste active).
- [x] Tâches liées à un client : champ `clientId` sur la tâche (sélecteur dans le formulaire de tâche + dans la modale de création, pré-rempli si créée depuis la fiche client). Section "Tâches liées" dans la fiche client (liste + case à cocher + ajout rapide par intitulé). Tag "👤 Nom du client" cliquable sur la tâche (ramène à la fiche). Les deux sens marchent sur le même tableau `tasks` partagé — pas de duplication de données.

## Responsive mobile/tablette

**État** : plusieurs bugs de débordement corrigés au fil de l'eau (`row3` sans règle mobile, `word-break` global qui cassait les mots courts des boutons — corrigé en le limitant au `textarea`, `input[type=date]` hors du style de base, scroll figé ≥901px scopé à la vue Devis).

**Ne pas casser** : toute règle CSS visant à corriger un débordement doit être testée à la fois sur mobile étroit (~375px) et tablette (~800-1024px) — plusieurs correctifs ont eu des effets de bord sur l'autre format.

**Notes / À faire**
- [x] Fix débordement `row3` (Échéance/Rappel/Priorité) sur mobile.
- [x] Limiter `word-break` au `textarea` (cassait les boutons du menu).
- [x] `input[type=date]` dans le style de base (désaligné sinon).
- [x] Scroll figé sur tablette (Tableau de bord et vue bureau).
- [ ] Réorganisation du menu principal (barre du haut) en version mobile — pas encore traité.
- [x] Barre du haut "mangée" par le contenu du dessous sur tablette (Devis, Vue bureau) — non reproduit en environnement de test à zoom 100% ; fix appliqué par précaution (`maximum-scale=1, user-scalable=no` sur le viewport, ce type de symptôme correspond à un conflit connu pinch-zoom + `position:sticky`). À reconfirmer sur son vrai appareil — si ça persiste après ce correctif, il faudra creuser plus loin (pas juste re-deviner).

## i18n & commercialisation

**État** : discuté, rien commencé côté code. Infra multi-comptes (Supabase/RLS) déjà en place — chaque compte a ses propres données — mais pas de parcours d'inscription self-service dans l'app (seule la connexion à un compte existant fonctionne).

**Notes / À faire**
- [ ] Traduction anglais (UI + devis).
- [ ] Traduction hébreu RTL.
- [ ] Langue de l'UI et langue du devis indépendantes l'une de l'autre.
- [ ] Parcours d'inscription self-service (actuellement, un compte doit être créé manuellement côté Supabase).

## Clients — bug de saisie (nom de client corrompu pendant la frappe)

**État** : bug réel signalé et corrigé. `handleRealtime()` et `loadAll()` remplaçaient l'objet client en mémoire par une nouvelle référence à chaque évènement Supabase (y compris l'écho de notre propre écriture, ~1s après une pause de frappe). Le champ nom en cours d'édition dans le DOM restait lié à l'ANCIEN objet (via la closure de l'input), devenu orphelin — la suite de la frappe n'était plus jamais sauvegardée, et un rendu ultérieur affichait l'ancienne valeur (parfois le nom par défaut "Client"). Corrigé : fusion en place (`Object.assign`, identité d'objet préservée) partout, + la fiche activement en cours de saisie ignore complètement les mises à jour distantes le temps de l'édition (`activeEditingClientId()`) — rien n'est perdu, le prochain `cloudPush()` renvoie la version locale plus récente.

**Ne pas casser** : ne jamais remplacer un élément de `clients`/`devisList` par une nouvelle référence d'objet (`arr[i]=nouveauObjet`) dans le code de synchro — toujours fusionner en place (`Object.assign(arr[i], nouveauObjet)`), sous peine d'orpheliner les champs de formulaire liés par closure. Le même risque existe en théorie pour `devisList`/`library`/`tasks` (non corrigé, non signalé à ce jour — à surveiller si un bug similaire est rapporté sur l'éditeur de devis ou les tâches).

**Notes / À faire**
- [x] Corriger la corruption du nom client pendant la frappe (fusion en place + protection de la fiche activement éditée).
- [ ] Vérifier si le même risque existe concrètement sur devis/tâches (pas de bug rapporté à ce jour, juste le même pattern de code repéré).

## Documents clients & tâches — lecteur DWG/DXF

**État** : ajout de fichiers `.dwg`/`.dxf` possible sur les clients et les tâches (jusqu'à 20 Mo). À l'ouverture, un lecteur CAD in-page s'affiche dans une modale (bibliothèque `@mlightcad/cad-simple-viewer`, chargée à la demande depuis esm.sh — aucune installation, aucun compte requis, gratuit). DXF géré nativement par la bibliothèque. DWG géré via `@mlightcad/libredwg-converter` (WASM, licence GPL-3.0) : ses deux fichiers binaires (`libredwg-web.wasm` ~10 Mo, `libredwg-parser-worker.js`) sont hébergés en statique dans `assets/cad/` du dépôt (voir `NOTICE.txt`/`LICENSE-libredwg-converter.txt` dans ce dossier), exécutés dans un Web Worker isolé — c'est l'isolation de licence voulue par les auteurs, l'appli elle-même reste MIT.

RVT (Revit) : **pas de solution gratuite** — seule option existante est Autodesk Platform Services (payant au-delà d'un petit quota, nécessite un compte développeur Autodesk à elle et l'envoi des fichiers clients sur le cloud Autodesk). Non implémenté, écarté par manque d'option gratuite/simple correspondant à la demande.

Pour éviter de saturer le quota `localStorage` (5-10 Mo par origine) avec des fichiers volumineux : au-delà de 3 Mo, un document n'est plus mis en cache local (`docStore`) — il reste seulement en mémoire pour la session + sur Supabase Storage (compte obligatoire de toute façon). Sur un appareil hors ligne, un très gros fichier CAD ne s'ouvrira qu'une fois reconnecté si pas déjà mis en cache.

**Ne pas casser** : `assets/cad/libredwg-web.wasm` et `assets/cad/libredwg-parser-worker.js` doivent rester dans le même dossier l'un que l'autre (le worker charge le wasm à côté de lui-même). `parserWorkerUrl` doit rester une URL absolue (résolue via `new URL(...,location.href)`) — une URL relative se résoudrait par erreur contre le domaine d'esm.sh si un jour ce chemin passe par un contexte de module externe.

**Notes / À faire**
- [x] Lecteur DWG/DXF in-page pour les documents clients et tâches (gratuit, sans compte, sans installation).
- [x] Isolation de licence GPL du convertisseur DWG (Web Worker séparé) + fichiers NOTICE/LICENSE dans `assets/cad/`.
- [x] Anti-saturation `localStorage` pour les gros fichiers (cache local désactivé au-delà de 3 Mo, cloud/mémoire pris le relais).
- [ ] RVT (Revit) : aucune option gratuite trouvée — resterait à évaluer si elle accepte un jour Autodesk Platform Services payant. Ce qu'il faudrait faire, le jour où c'est validé :
  - [ ] Elle crée un compte développeur Autodesk Platform Services (APS) — https://aps.autodesk.com — et une "app" pour obtenir un `client_id`/`client_secret`.
  - [ ] Vérifier le tarif réel au moment voulu (modèle qui change le 17/08/2026 d'après ce qui a été trouvé) et le nombre de conversions gratuites incluses.
  - [ ] Stocker `client_id`/`client_secret` côté serveur uniquement (jamais dans `index.html` en clair — actuellement tout est front-end statique, donc il faudrait une petite fonction serverless, ex. Supabase Edge Function, pour l'auth OAuth2 + upload vers le bucket Object Storage APS).
  - [ ] Flux Model Derivative API : upload du .rvt vers le bucket APS → lancement de la conversion (`POST /modelderivative/v2/designdata/job`) → polling du statut → une fois prêt, charger le viewer via le SDK `Autodesk.Viewing.Viewer3D` (script JS officiel APS) dans une modale, comme pour DWG/DXF.
  - [ ] Prévenir clairement l'utilisatrice/ses clients que les fichiers .rvt transitent et sont stockés temporairement sur le cloud Autodesk (pas seulement Supabase) — implication RGPD/confidentialité à valider avec elle avant d'activer.
  - [ ] Prévoir un garde-fou de coût (quota, alerte) vu que c'est payant au-delà du seuil gratuit.

## Clients — relance de paiement

**État** : dans la fiche client (partie financière, sous le récap "Devis — montant"), message de relance généré automatiquement à partir du montant total / déjà réglé / solde restant (`relanceText()`). Boutons "📋 Copier" (presse-papier) et "💬 WhatsApp" (ouvre wa.me pré-rempli, réutilise `toWhatsAppPhone()`). Le texte est éditable avant copie/envoi. Si le solde est à 0, affiche juste "Solde à jour" (pas de relance à faire).

**Ne pas casser** : `copyRelanceText()`/`sendRelanceWhatsApp()` lisent la valeur actuelle du `<textarea>` (pas `relanceText()` recalculé) — pour respecter les éventuelles modifications manuelles du texte avant envoi.

**Notes / À faire**
- [x] Message de relance auto-généré (montant/réglé/reste) dans la fiche client.
- [x] Copier presse-papier + envoi WhatsApp direct.
- [x] Détail des règlements dans le message (montant + date si renseignée, sinon omise sans bloquer). Champ date optionnel ajouté sur chaque ligne de paiement.

## Clients — tableau (colonnes trop larges, débordement horizontal)

**État** : colonnes resserrées (Début/Statut/4 colonnes montants + gap réduit) pour que le tableau tienne dans ~740-840px sans avoir besoin de défiler horizontalement sur tablette/petit bureau. `.cl-table{min-width:840px}` faisait déborder systématiquement même après resserrement des colonnes — c'était la vraie cause, ramené à 680px. Nom de client trop long : ellipsis au lieu d'élargir toute la ligne (`.cl-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`).

**Ne pas casser** : un `div.grid` de largeur `auto` (pas de `width:100%` explicite) grandit à la taille de contenu de ses enfants (ex. un nom non tronqué) même à l'intérieur d'un parent `overflow-x:auto` — il ne se limite pas silencieusement à l'espace disponible. D'où le combo nécessaire : `width:100%` sur `.cl-row` + un plancher raisonnable sur `.cl-table` (`min-width`) + ellipsis sur le texte qui peut être long, plutôt que de compter sur le simple resserrement des colonnes fixes.

**Notes / À faire**
- [x] Colonnes resserrées, tableau tient sans défilement horizontal sur tablette/petit bureau.
- [x] `.cl-table{min-width}` ramené à une valeur cohérente avec les nouvelles largeurs de colonnes (840→680px).
- [x] Nom de client long : ellipsis au lieu de faire déborder la ligne.

## Clients — fiche détaillée, mise en page (trop fine/plate)

**État** : fiche client refaite en deux colonnes ("Modèle C" — proposé via 3 maquettes comparées sur un canvas Claude Design, choisi par l'utilisatrice). Colonne gauche fixe (`.cl-side`, ~220px) : avatar (initiales), nom, statut, contact/téléphone/email — coordonnées d'identité rapides. Colonne droite (`.cl-main`) : blocs à bandeau plein-ton (`.cl-card`/`.cl-card-bar`) — 📋 Général (ville/début/fin/commentaire), 💰 Financier (montant devis, devis liés, paiements, relance, commissions), ✅ Tâches liées, 📎 Documents. Empile en une colonne sous 760px (mobile).

Aucune fonction interne modifiée (`buildRelanceBox`, `buildClientDevisList`, `buildSubList`, `buildCommissionList`, `buildClientTasksBox`, `buildDocGallery`) — uniquement la structure/l'habillage autour, via deux nouveaux petits helpers (`wireMetaInputs`, `cardWrap`). Tous les champs (nom, statut, contact, téléphone, email, ville, début, fin, commentaire, montant/devise, paiements, commissions, tâches, documents) testés réels après la refonte — comportement identique à avant, juste réorganisé visuellement.

**Ne pas casser** : les champs "Contact/Téléphone/Email" sont dans `.cl-side` (colonne gauche) et "Ville/Début/Fin/Commentaire" dans la carte "Général" (colonne droite) — si on ajoute un nouveau champ client, choisir consciemment sa colonne plutôt que de tout mettre au même endroit par défaut.

**Notes / À faire**
- [x] 3 maquettes proposées (onglets / cartes couleur / deux colonnes), choix de l'utilisatrice : deux colonnes.
- [x] Implémentation réelle sans régression (toutes les fonctionnalités existantes vérifiées après refonte).
- [x] Ajustements après retour : "Général" fusionné dans la colonne gauche sous Email (ville/début/fin/commentaire, sans titre "Général" — coordonnées de base) ; Relance client déplacée entre Paiements et Commissions ; phrase "choisissez la catégorie" remplacée par des en-têtes de colonnes (Catégorie/Intitulé/Montant/Date) ; phrase "Reste = montant final…" supprimée ; icône 🗑 sur "Supprimer ce client".
- [x] Devis-montant (🧾) et Commissions prestataires (🤝) passés en vrais bandeaux marron (`cardWrap`, comme Tâches liées/Documents/Financier) — le simple encadré fin (`.cl-subbox`) ne suffisait pas visuellement, demande explicite d'un "vrai" bandeau avec icône. `.cl-subbox` supprimé (plus utilisé).

## Clients — statuts modulables (en cours/devis/terminé/annulé + persos)

**État** : statuts clients passés d'une liste figée (4 valeurs codées en dur, couleurs par classe CSS fixe) à une liste éditable dans `library.clientStatuses`, même pattern que `taskCategories`/`chantierCats`. Panneau `⚙ Statuts` (à côté de "+ Nouveau client") : ajout/renommage/couleur (`<input type="color">`)/suppression/réinitialisation. Toutes les consommations migrées : puces de filtre + légende (régénérées à chaque rendu, plus de liste figée dans le HTML), point de couleur sur la ligne client (`updateClientRow`, `renderClients`), tri par statut (rang = index dans `library.clientStatuses`, plus une map codée en dur), menu déroulant statut dans la fiche client (`clientStatusOptionsHtml`). Suppression d'un statut utilisé par un client : ce client bascule automatiquement sur le premier statut de la liste (`clientStatus(c)` a aussi ce fallback en lecture, donc pas de crash même sans migration explicite).

**Ne pas casser** : `DEFAULT_CLIENT_STATUSES` garde des id fixes (`en_cours`/`devis`/`termine`/`annule`, pas `uid()`) — `computeTodos()` filtre encore explicitement `c.statut!=='annule'` en dur, donc si on retouche les statuts par défaut il faut garder cet id stable ou mettre à jour cette référence.

**Notes / À faire**
- [x] `library.clientStatuses` (id/label/color), `ensureClientStatuses()`, `clientStatus(c)`, `clientStatusOptionsHtml(c)`.
- [x] Panneau CRUD `⚙ Statuts` (ajout/édition/couleur/suppression/reset), autosave via `saveLibraryDebounced()`.
- [x] Puces de filtre + légende régénérées dynamiquement (`renderClientStatusFilters()`, appelé à chaque `renderClients()`).
- [x] Point de couleur (ligne client + fiche détail) et tri par statut migrés sur `library.clientStatuses` (plus de classes CSS fixes `.dot.green/orange/red/blue`, supprimées).
- [x] Testé réel (Playwright) : ajout d'un statut custom "VIP" propagé partout (puce, légende, point, tri, menu déroulant), suppression d'un statut avec bascule automatique des clients concernés, reset par défaut, autosave, zéro régression sur les 4 statuts d'origine, zéro débordement horizontal.

## Clients — vue mobile réelle (Chrome/Safari/Samsung Internet), contenu tronqué

**État** : sur un vrai téléphone (pas le mode « bureau » du navigateur, ni le toggle interne "Vue mobile"/"Vue bureau" qui ne concerne que l'onglet Devis), la fiche client ouverte affichait du texte coupé net sur toute la largeur (nom, statut, montant, reste…), sans aucun moyen de faire défiler pour le voir. Cause racine réelle (diagnostiquée via mesures `getBoundingClientRect` + captures d'écran à 390px, pas par déduction) : `.cl-table{min-width:680px}` — nécessaire pour la grille de colonnes fixes de la ligne client sur tablette/bureau — s'appliquait aussi à TOUTE la fiche détaillée d'un client ouvert (elle vit dans le même `#cl-table`), et `.cl-group.open{overflow:hidden}` rognait silencieusement tout ce qui dépassait de l'écran au lieu de proposer un défilement. Deuxième cause, indépendante, révélée une fois la première corrigée : `.cl-two-col{align-items:flex-start}` — pensé pour la mise en page en ligne (bureau) — empêchait ses deux colonnes de s'étirer à la largeur du conteneur une fois empilées en colonne (mobile) ; chaque bloc se dimensionnait alors sur son propre contenu (ex. la ligne montant/devise/reste du devis) au lieu d'être contenu par l'écran.

**Ne pas casser** : en dessous de 680px, `.cl-table{min-width:0}` et la ligne client (`.cl-row`) devient une carte flex empilée (nom en haut, montant/reste en dessous, commissions masquées — toujours visibles dans le détail ouvert) au lieu de la grille à 10 colonnes fixes ; au-dessus de 680px, comportement bureau/tablette inchangé (grille, min-width 680px, tout comme avant — revérifié à 768/900px, zéro régression). En dessous de 760px, `.cl-two-col` passe en colonne avec `align-items:stretch` (pas `flex-start`) — sans ce `stretch`, tout contenu interne légèrement trop large fait à nouveau déborder toute la colonne au lieu d'être contenu par elle.

**Notes / À faire**
- [x] Root cause diagnostiquée par mesure réelle (`getBoundingClientRect` sur toute la chaîne d'ancêtres à 390px), pas par supposition — a révélé 2 causes indépendantes, pas une seule.
- [x] `.cl-table{min-width:0}` + ligne client en carte flex empilée sous 680px (masque l'en-tête de colonnes triable, devenu inutile en carte).
- [x] `.cl-two-col{align-items:stretch}` sous 760px (au lieu de `flex-start`) pour que les colonnes empilées se calent sur la largeur d'écran réelle.
- [x] `.cl-montant` (ligne montant/devise/reste du devis) passée en colonne empilée sous 680px.
- [x] Testé réel : 390px (iPhone) capture d'écran avant/après (plus aucun texte tronqué), 360px sans débordement, 768/900px bureau/tablette identiques à avant (zéro régression), édition de champ + changement de statut fonctionnels sur mobile après le correctif CSS.

## Nettoyage de code

**État** : passe de nettoyage effectuée une fois (code mort supprimé — dont des données clients réelles codées en dur —, CSS dupliqué fusionné, `pickImageFile()` factorisé pour les 7 imports d'image).

**Notes / À faire**
- [x] Nettoyage code mort + CSS dupliqué + factorisation import image.
- [ ] Repasser dessus périodiquement si le fichier continue de grossir.

## Galerie de réalisations — embellissement des photos

**État** : **livré et déployé** (étapes gratuites). Espace « Réalisations » en ligne dans l'appli : import des photos en pleine définition, éditeur de retouche non destructif, export prêt pour le site, mémo de prise de vue. Aucun service externe payant branché à ce stade — décision volontaire, voir plus bas.

**Deux circuits distincts — ne pas les confondre** (erreur de cadrage faite au premier tour, corrigée par l'utilisateur) :
- **Documents client** (existe déjà) : fiche client → Documents. Factures, plans, photos de chantier prises en vrac. Usage interne, jamais publié. Compression à 1400 px / JPEG 0,82 dans `readFileAsDoc()` — **c'est adapté à cet usage, ne pas y toucher au titre de ce chantier.**
- **Galerie de réalisations** (à créer) : chantier terminé → photos retenues → embellissement → publication sur le site. Circuit séparé, pleine définition, **ne passe jamais par les documents client**.

**Problème** : les photos de fin de chantier sont prises au téléphone et n'ont pas un rendu assez professionnel pour la galerie publique (architecture d'intérieur).

**Triage des défauts** (ce qui est corrigeable gratuitement côté navigateur vs ce qui exige un service externe payant) :
- Gratuit, déterministe, sans envoi extérieur : verticales fuyantes (correction géométrique), balance des blancs, exposition, homogénéité d'une série (un réglage appliqué à toutes les photos d'un chantier).
- Payant, service externe : fusion HDR (fenêtre cramée / pièce sombre — la donnée n'existe pas dans le fichier), effacement d'objets (générative).
- Non rattrapable en retouche, relève de la prise de vue : ultra grand-angle 0,5×.

**Options externes retenues à ce stade** (tarifs relevés en septembre 2026, à reconfirmer avant tout achat) :
- [Autoenhance.ai](https://www.autoenhance.ai/api) — spécialisé immobilier/archi (perspective, HDR, balance des blancs, RAW), vraie API, aperçu gratuit filigrané **sans compte**. Plans annoncés : Essential ~29 $/mois 50 images, Advanced ~109 $/mois 250, Expert ~449 $/mois 1500 ; report des crédits 1 mois ; facturé au téléchargement, pas à l'essai.
- Gemini / Nano Banana (image) — ~0,04 à 0,15 $/image selon le modèle et la résolution, pour l'effacement d'objets uniquement.
- [Adobe Firefly Services / Lightroom API](https://developer.adobe.com/firefly-services/docs/lightroom/guides/) — Auto Tone et Auto Straighten (Upright) exactement adaptés, mais **contrat entreprise requis, tarifs non publiés** — écarté à ce stade.
- Upscaling type Topaz (à partir de ~0,05 $/image) — **écarté** : les photos de téléphone font déjà 12 Mpx, la résolution n'est pas le problème.

**Point à trancher par l'utilisateur, pas par nous** : la retouche générative repeint des pixels. Effacer une poubelle est défendable ; laisser l'outil redessiner une menuiserie ou un plafond fait que la photo ne montre plus le chantier réellement livré. Décision 3 de la fiche.

**Réponses de l'utilisateur** (fiche du 04/09/2026) : l'outil vit **dans le CRM** (`onglet-crm`), volume **20 à 100 photos/mois**, retouche générative « juste embellir, pas ajouter ni supprimer des choses sauf si ça nous dérange vraiment », et un outil externe déjà connu « éventuellement, si on galère ». Deux décisions restées ouvertes : **le site** (sur quoi il tourne) et **le budget** — aucune des deux ne bloquait la partie gratuite, qui a donc été faite d'abord.

**Ce qui a été livré** :
1. [x] Espace « Réalisations » (5e onglet) : une réalisation par chantier terminé, nom/client/date, photos en pleine définition (2560 px, JPEG 0,92), photo de couverture.
2. [x] Éditeur non destructif, rendu WebGL en un seul passage (utilisable en direct depuis un téléphone) : **Verticales** (homographie carré→quadrilatère, méthode Heckbert, avec compensation verticale), **Rotation** (avec zoom automatique pour ne jamais laisser de coin vide), **Lumière** (exposition, contraste, température, teinte, saturation), **Cadrage** (libre / 3:2 / 4:3 / 16:9 / 1:1 + position). Appui long sur la photo = comparaison avec l'original.
3. [x] **Réglage auto** : balance des blancs gris-moyen + exposition + contraste calculés sur un échantillon 64×64. L'exposition est calculée APRÈS la balance des blancs et en tenant compte du contraste — sinon l'image reste sous-exposée dès qu'il faut neutraliser une dominante chaude (mesuré : luminance 92,6 → 98,8 avant correction du calcul, 92,6 → 122,3 après).
4. [x] **Appliquer la lumière à toute la série** : copie exposition/contraste/température/teinte/saturation sur toutes les photos de la réalisation, **sans** copier la géométrie (propre à chaque photo). C'est ce qui donne l'unité d'une vraie galerie.
5. [x] **Appliquer ce format à toute la série** (onglet Cadrage).
6. [x] Export « pour le site » : rendu JPEG à 2560 / 1920 / 1280 px, retouches appliquées, originaux intacts.
7. [x] Mémo de prise de vue (bouton « 📷 Bien photographier »).
8. [ ] Publication directe vers le site — **en attente de la décision 1** (sur quoi tourne le site). En l'état, l'export produit des fichiers à déposer à la main.
9. [ ] Bouton « Embellir » sur un service externe (fenêtre cramée, effacement d'objets) — **en attente de la décision 2** et d'un test sur ses vraies photos. Le jour où c'est validé : même patron que `supabase/functions/embellish/index.ts` (clé en secret côté serveur, jamais dans `index.html`).

**Ne pas casser** :
- Les deux circuits restent séparés. `readFileAsDoc()` (documents client) doit **rester** à 1400 px / JPEG 0,82 : c'est adapté à une pièce jointe de dossier. Ne jamais aligner l'un sur l'autre. Un test le vérifie explicitement.
- Les fichiers photo vont dans le bucket `client-docs` avec **la même forme de chemin que les documents** (`ownerId/<clé>`, clés préfixées `rp_` pour la pleine définition et `rt_` pour la vignette). La policy Supabase en place autorise exactement cette forme — ne pas introduire de sous-dossier sans avoir vérifié la policy d'abord.
- Rien n'est mis en `localStorage` côté photos (une photo de publication pèse ~1 Mo, le cache local sature) : mémoire bornée + cloud. `photoStore.mem` est plafonné à 40 entrées, le cache d'images décodées à 2 (une photo 2560 px décodée pèse ~26 Mo en RAM).
- Les mises à jour distantes sont fusionnées **en place** (`mergeRealisations`) et ignorées pendant une saisie ou pendant que l'éditeur est ouvert (`isEditingRealisations`). Sans ça on reproduisait le bug de corruption du nom de client : un champ lié à un objet remplacé devient orphelin et n'est plus jamais sauvegardé.
- La **sauvegarde JSON** contient les réalisations et leurs **vignettes seulement**. Les photos en pleine définition vivent dans le stockage Supabase (lié au compte, donc insensible à un vidage de cache) et se récupèrent via « Exporter pour le site ». Les inclure ferait un JSON de plusieurs centaines de Mo, impossible à produire depuis un téléphone.
- `.viewnav` doit garder `flex-wrap:wrap` : sans ça, un onglet de plus fait déborder la barre du haut sur mobile (mesuré : 450 px de contenu pour 375 px d'écran).

## Site vitrine public (dépôt séparé)

**État** : **en ligne** — https://rnab26.github.io/melissa-nabet-site/ (dépôt
`rnab26/melissa-nabet-site`). Aucune réalisation publiée pour l'instant : la page affiche
son état « Bientôt en ligne », c'est normal.

**Vérifié en conditions réelles** (pas déduit) :
- La page servie ne contient aucune clé (`grep` sur les octets téléchargés).
- Le stockage public répond avec `access-control-allow-origin: *`, donc la page peut lire
  le manifeste depuis un autre domaine.
- Un objet absent renvoie `HTTP 400` avec un corps
  `{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"}`.
  C'est le cas de la **première publication** : `readManifest()` doit le reconnaître comme
  « pas encore de manifeste » et repartir d'un manifeste vide, sinon la toute première
  publication échouerait. Le stub du test reproduit exactement cette réponse — ne pas le
  « simplifier ».

**Décision de l'utilisateur** : le site public ne doit PAS partager son adresse avec le
CRM. « Sinon les gens vont consulter des choses qu'ils ne devraient pas voir. » Le CRM est
pourtant déjà inaccessible sans connexion (policies `app_data` vérifiées en base :
`auth.uid() = owner` sur SELECT/INSERT/UPDATE/DELETE, un anonyme ne lit rien) — la
séparation est une exigence d'adresse, pas un correctif de faille.

**Architecture** :
- Bucket Supabase `galerie`, **public en lecture**, créé par migration
  `galerie_publique_bucket`. Écriture limitée au dossier du propriétaire
  (`foldername[1] = auth.uid()`), lecture anonyme limitée à ce bucket. `client-docs`
  (documents clients, photos non publiées) reste totalement privé.
- Le CRM y dépose des copies redimensionnées (1600 px et 700 px), retouches appliquées,
  plus un `manifest.json`. Les originaux ne quittent jamais le stockage privé.
- Le site lit `manifest.json` et les images par leurs URLs publiques. **Il ne contient
  aucune clé d'accès** — un test le vérifie explicitement.

**Ne pas casser** :
- Ne jamais mettre de clé Supabase (même « publishable ») dans `site-vitrine/index.html`.
  Le site n'en a pas besoin : tout ce qu'il lit est public.
- `site-vitrine/` est retiré de l'artefact GitHub Pages du CRM (étape `rm -rf site-vitrine`
  dans `.github/workflows/pages.yml`). Vérifié en ligne : `…/Melissa-Nabet/site-vitrine/`
  renvoie 404. Ne pas supprimer cette étape tant que le dossier vit dans ce dépôt.
- Le manifeste se relit par l'**API authentifiée**, jamais par l'URL publique : le CDN peut
  servir une version périmée, et une coupure réseau se confondrait avec « pas de
  manifeste ». Dans les deux cas on republierait à partir d'un état vide, ce qui
  dépublierait toutes les autres réalisations. Seul un manifeste réellement absent (404)
  fait repartir de zéro. Un test reproduit la panne.
- Republier avec moins de photos qu'avant doit continuer à supprimer les fichiers
  orphelins du bucket : sinon ils restent accessibles publiquement hors galerie.

## Photos — sélection multiple, téléchargement et suppression en lot

**État** : livré et déployé. Besoin réel : plusieurs personnes alimentent la même galerie
depuis des téléphones différents, il faut pouvoir récupérer sur son propre appareil des
photos ajoutées depuis celui de quelqu'un d'autre, et faire le ménage à plusieurs.

Bouton « ☑ Sélectionner » dans une réalisation : appui = cocher, barre d'actions en bas
(tout sélectionner / télécharger / supprimer / annuler). Deux choix au téléchargement,
explicités dans la fenêtre : **telles qu'importées** (pour récupérer l'image sur un autre
appareil) ou **avec les retouches**.

**Ne pas casser** :
- Le téléchargement en lot doit rester **un seul fichier .zip**. Une rafale de liens de
  téléchargement est bloquée par les navigateurs mobiles après le premier fichier — c'est
  exactement le cas d'usage visé. L'ancien export photo par photo a été supprimé pour
  cette raison ; ne pas le réintroduire.
- L'archive est écrite à la main (`buildZip`, méthode « store », sans dépendance externe) :
  un JPEG est déjà compressé, le recompresser ne gagnerait rien et coûterait du calcul sur
  un téléphone. Le test fait relire l'archive produite par `unzip -t` — ne pas remplacer ce
  contrôle par une relecture de code, un ZIP mal formé reste silencieux jusqu'à l'ouverture.
- « Telles qu'importées » = le fichier stocké à l'import (jusqu'à 2560 px), **pas** le
  fichier brut de l'appareil photo, qui n'est jamais envoyé. Le libellé de la fenêtre le
  dit ; si on change la limite d'import, mettre ce texte à jour.
- Sur la barre d'actions (fond sombre), ne pas utiliser `.btn-onlight` : il écrit en foncé
  sur foncé et rend le bouton invisible. Les règles `.rz-selbar .btn` sont là pour ça.

**Vérification** : `tests/realisations.test.mjs` (Playwright + WebGL réel, 37 contrôles). C'est la méthode de référence pour ce chantier — elle **mesure** le rendu (convergence des verticales sur une façade en trapèze, dominante couleur, luminance, ratio de recadrage) au lieu de relire le code. Mode d'emploi dans `tests/README.md`.

**Notes / À faire**
- [x] Cadrage : circuit galerie séparé du circuit documents client (recadré par l'utilisateur).
- [x] Recherche et chiffrage des options externes.
- [x] Fiche de décision publiée (5 questions).
- [ ] Lire les réponses de la fiche avant de coder.
- [ ] Obtenir 3 à 5 photos réelles typiques pour mesurer le gain réel avant tout achat.
- [x] Étapes 1 à 7 (gratuites) : livrées, testées, mergées sur `main`, déployées.
- [x] Étape 8 : publication vers le site. Bouton « Publier sur le site » par réalisation.
- [x] Dépôt `rnab26/melissa-nabet-site` créé par l'utilisateur, site poussé dessus.
- [x] GitHub Pages activé par l'utilisateur (Settings → Pages → Source : « GitHub Actions »).
      `enablement: true` sur `configure-pages` ne suffit pas : le jeton du workflow n'a pas
      le droit de créer le site Pages (« Resource not accessible by integration »), ni le
      connecteur GitHub de la session. **Sur un futur dépôt, c'est une manip inévitable.**
- [x] Site en ligne : https://rnab26.github.io/melissa-nabet-site/ (HTTP 200, 17 contrôles
      rejoués sur les octets réellement servis, aucune clé dans la page).
- [x] Sélection multiple de photos : téléchargement en lot (.zip) et suppression en lot.
- [ ] Étape 9 (service externe payant) — bloquée sur la décision 2 et sur un test sur ses vraies photos.
- [ ] Obtenir 3 à 5 photos réelles typiques : rien n'a encore été mesuré sur de vraies photos de téléphone, uniquement sur une image de synthèse.
- [ ] La barre de navigation passe maintenant sur deux lignes en mobile (5 onglets). Ça règle le débordement mais la refonte du menu mobile, déjà notée plus haut, devient plus pertinente.


## Retouche IA — pont ouvert vers un agrégateur de modèles

**État** : **livré, déployé et branché** — clé fal.ai en place, crédits rechargés.

**Ce que l'utilisateur demandait** : ne pas être lié à un modèle, recharger des crédits une
fois chez un fournisseur qui regroupe les IA, et choisir le modèle depuis le CRM.

**Réponse retenue** : `fal.ai` — un agrégateur, un compte, des crédits, des dizaines de
modèles d'image. Forme HTTP vérifiée dans leur documentation : `POST https://fal.run/<modèle>`,
en-tête `Authorization: Key …`, corps `{prompt, image_urls:[data URI], sync_mode:true}`.
Réponse : `{images:[{url}]}`, où `url` est un data URI quand `sync_mode` est vrai.

**Faits vérifiés, à ne pas re-deviner** :
- **L'API Anthropic ne génère ni ne modifie d'images.** Claude ne peut pas retoucher une
  photo. Le bouton « Embellir » des devis n'a pas d'équivalent image chez Anthropic.
- Tarifs relevés en septembre 2026 : Nano Banana Pro ~0,13 $ l'image en 1-2K (0,24 $ en 4K)
  via Google, moins cher chez les revendeurs ; FLUX.2 entre 0,014 et 0,07 $ le mégapixel.
  À 20-100 photos/mois : 1 à 15 $/mois.

**Architecture** :
- `supabase/functions/photo-ia` — pont provider-agnostique. Reçoit `{model, prompt,
  imageDataUri}`, route vers fal, renvoie un data URI.
- Côté CRM : onglet « ✨ IA » dans l'éditeur, consigne libre, liste de modèles **modifiable
  par l'utilisateur** (`library.iaModels`) — coller un identifiant du catalogue suffit,
  rien à recoder. Consignes récentes mémorisées. Compteur mensuel d'appels facturés.

**Ne pas casser** :
- **Les fonctions serveur ne doivent JAMAIS accepter la clé publiable comme jeton.** C'était
  le cas de `embellish` : cette clé est lisible dans `index.html`, page publique, donc
  n'importe qui pouvait consommer les crédits Anthropic du compte. Les deux fonctions
  vérifient maintenant un vrai utilisateur auprès de `/auth/v1/user`. **Vérifié en vrai** :
  401 « session invalide » avec la clé publique, 401 « authentification requise » sans jeton,
  sur les deux fonctions.
- `verify_jwt` est **volontairement désactivé** au déploiement des deux fonctions : la clé
  publiable est elle-même un JWT valide, donc la vérification générique de Supabase
  laisserait passer n'importe qui. Le contrôle réel est dans `requireUser`. Ne pas
  « corriger » en réactivant verify_jwt en croyant renforcer la sécurité — ce serait
  l'affaiblir.
- Le résultat IA est stocké **à côté** de l'original (`rp_<id>`), jamais à sa place.
  Depuis septembre 2026, une photo porte une PILE de versions et non plus une seule : chaque
  retouche a sa propre clé (`ra_<id>` pour la première, `ra_<id>_<version>` pour les
  suivantes) et `photo.active` décide de celle qui est affichée, exportée et publiée.
  Voir « Plusieurs versions par photo » plus bas.
- L'envoi au modèle part **toujours** de l'original (`loadPhotoImage(..., {original:true})`)
  avec les corrections géométriques et de lumière appliquées — jamais d'une sortie IA
  réinjectée dans l'IA, qui dériverait à chaque passage.
- La photo est réduite à 1600 px avant l'envoi : au-delà, la requête devient trop lourde
  pour la fonction serveur, et les modèles ressortent de toute façon dans leur propre
  définition.

**Deux portées de clé chez fal — ne pas confondre les deux échecs** :
- **portée API** : consommer les modèles. C'est la clé en place, et c'est tout ce qu'il faut
  pour retoucher.
- **portée ADMIN** : les API de plateforme, dont `GET /v1/account/billing` qui donne le solde.
  La clé actuelle s'y fait refuser — d'où « Solde : n/c » dans le panneau.

Un solde illisible **ne dit rien** sur la retouche : ce sont deux droits différents. Le
panneau l'écrit en clair au lieu de laisser croire à une panne. Pour afficher le solde, il
faudrait une clé de portée ADMIN dans `FAL_KEY` (chantier `ph12`, confort pur).

**L'échec de solde est mémorisé comme le succès** (60 s) : sans ça, chaque ouverture de
l'éditeur relançait un appel voué à échouer.

**Le pont trace ses échecs** (`console.error` sur l'authentification, le solde, le schéma et
l'exécution). Avant, un 502 ne laissait dans les journaux Supabase que les lignes de
démarrage : rien à diagnostiquer à distance. Déployé en version 4.

**Vérification** : `tests/realisations.test.mjs` (93 contrôles) couvre le panneau IA, le
jeton réellement envoyé au pont, la non-destruction de l'original, la bascule entre les deux
versions, et le message d'échec du solde. Le test intercepte le pont : il ne dépense aucun
crédit.

### Ce qui manquait pour que ce soit utilisable, pas seulement fonctionnel (septembre 2026)

Remarque de l'utilisateur, et elle est juste : « il manque systématiquement la suppression,
la modification, le réglage, le message d'erreur, l'état vide ». Règle de livraison désormais :
**une fiche d'usage AVANT le code** (ce qu'on pourra faire, ce qui sera réglable et où, ce
qu'on voit quand c'est vide / en chargement / en erreur, ce qui n'est volontairement pas
couvert), puis parcours à l'écran sur un format téléphone avant de déployer.

**Comparateur avant / après** — après une retouche il n'y avait qu'une image à l'écran et
rien ne disait ce qui avait changé. Le curseur coupe la photo en deux (AVANT / APRÈS) et se
déplace au doigt. Deux gestes qui ne coexistent jamais : curseur s'il existe une version IA,
appui long sinon. **Piège** : `glRenderTo` dessine toujours dans le MÊME canevas WebGL — le
premier rendu doit être recopié avant le second, sinon les deux « versions » sont la même
image. Si la seconde version ne se charge pas, l'écran le dit au lieu de disparaître.

**Historique par photo** (bouton 🕘) — import, réglages, retouche IA avec son modèle et sa
consigne, publication, retrait. Effaçable, avec confirmation. Longueur réglable.

**État de publication PHOTO PAR PHOTO** — pastille sur chaque vignette (en ligne / modifiée ·
à republier / pas encore en ligne) et décompte dans la fiche. `r.published` ne disait rien de
la photo ajoutée après coup. Repose sur `p.publishedAt` (posé à la publication) comparé à
`p.touchedAt` (posé par `photoTouch` à chaque modification visible).

**Réglages — Photos & retouche IA** (`library.iaSettings`, panneau Réglages ou pied de
l'onglet Retouche) : résolution demandée, **plafond mensuel qui BLOQUE** l'envoi (rien n'est
facturé au-delà), coût unitaire estimé, longueur d'historique, modèle par défaut,
confirmation avant envoi. Toute valeur invalide est refusée à l'écran avec sa raison.
**Ne plus jamais coder en dur une valeur de ce genre.**

**Erreurs qui restent à l'écran** — un `toast` s'efface en trois secondes, trop court pour
lire pourquoi un appel a échoué. L'échec d'une retouche (`_iaLastError`) et l'échec d'une
publication (`_pubLastError`) restent affichés, avec le détail exact du fournisseur, jusqu'à
la prochaine tentative ou jusqu'à ce qu'on les masque.

**Suppressions confirmées** — retirer un modèle, vider un historique : confirmation comme
partout ailleurs dans le CRM.

**Modèles** — les 14 du catalogue sont dans la liste déroulante, rangés par usage. Le panneau
« Mes modèles » ne sert plus qu'aux ajouts manuels : y recopier le catalogue n'avait aucun
effet visible, c'était une redondance. `library.iaModels` ne contient QUE des ajouts manuels
et les entrées héritées qui doublonnent le catalogue sont retirées au chargement.

**États vides** — réalisation sans photo, historique vide : l'écran explique quoi faire.

### Quatre défauts corrigés après le premier essai réel (septembre 2026)

Signalés par l'utilisateur : « le bouton Gérer ne fonctionne pas », « le bouton pour lancer
la retouche ne fonctionne pas », « je n'ai accès qu'à 3 modèles ».

1. **Les deux boutons n'étaient pas morts : les fenêtres s'ouvraient DERRIÈRE l'éditeur.**
   L'éditeur photo occupe tout l'écran à `z-index:80`, la fenêtre modale était à `40`.
   Confirmation d'envoi et panneau des modèles existaient, invisibles et inatteignables.
   `.overlay` passe à 90, `.toast` à 100, `#login-overlay` à 110.
   **Ne jamais redescendre `.overlay` sous 80** : toute fenêtre ouverte depuis l'éditeur
   redeviendrait invisible, et le bouton qui l'ouvre paraîtrait mort.

2. **Le pont envoyait l'image sous le mauvais champ pour la moitié du catalogue.**
   Chez fal, certains modèles attendent `image_urls` (tableau : Nano Banana, FLUX.2,
   Seedream, Qwen Plus), d'autres `image_url` (chaîne : FLUX.1 Kontext, Qwen, les
   agrandisseurs). Le pont envoyait toujours `image_urls` — **deux des trois modèles
   proposés d'origine ne pouvaient donc pas fonctionner**. `buildPayload` lit maintenant le
   schéma du modèle et place l'image sous le nom qu'il déclare. Dans la foulée : la consigne
   n'est exigée que si le modèle la déclare obligatoire, et tout réglage inconnu du modèle
   est retiré (un réglage mémorisé pour un modèle faisait échouer le suivant).
   **Ne jamais revenir à un nom de champ écrit en dur.**

3. **Les corrections manuelles étaient appliquées deux fois.** Ce qui part au modèle, ce
   sont les corrections déjà appliquées : elles sont cuites dans l'image renvoyée. Elles
   restaient actives dans `photo.edit` et étaient donc réappliquées par-dessus, à l'écran,
   à l'export et à la publication. Chaque version porte maintenant ses propres réglages
   (`photo.editOrig` / `photo.editIa`, bascule par `iaUseVersion`).

4. **La sortie était demandée en 1K** (défaut du modèle) alors que la publication écrit en
   1600 px : l'image publiée était un agrandissement. Le CRM demande 2K quand le modèle
   l'accepte (`IA_PREFS`, vérifié contre son schéma avant l'envoi).

**Catalogue** : 14 modèles rangés par usage (retouche par consigne, retouche ciblée,
agrandissement), **chaque identifiant vérifié un par un** contre le catalogue réel de fal
(son `openapi.json` répond 200). Ajout en un geste depuis « ⚙ Gérer ». Le champ libre reste
là pour n'importe quel identifiant de `fal.ai/models` : le pont lit le schéma et s'adapte.

**Nouvelle suite de test** : `tests/pont-ia.test.mjs` (`bun tests/pont-ia.test.mjs`) vérifie
`buildPayload` sur des schémas relevés sur l'API réelle. C'est la seule partie que le test
navigateur ne peut pas voir : il intercepte le pont, il ne l'exécute pas.

### Panneau de retouche — refonte (septembre 2026)

**Demande** : « rends ça plus ergonomique, plus agréable, style site pro connu, la c'est trop
rustique — et passe le mode IA en premier choix plutôt que les réglages manuels. »

**Ce qui a changé** :
- La retouche IA est le **premier onglet et l'onglet ouvert par défaut** (`_ed.tab='ia'`).
  Les curseurs manuels sont un rattrapage ; la consigne écrite est ce qui rend une photo
  publiable. Ouvrir sur « Géométrie » mettait le rattrapage en avant.
- Onglets en **segment** (une piste, une pastille) au lieu de quatre boutons séparés.
  L'onglet IA garde la couleur de marque quand il est actif.
- Panneau découpé en **cartes**, une par question : ce que je veux (consigne, consignes
  toutes prêtes, un seul bouton pleine largeur), avec quel modèle (choix + réglages avancés
  repliés), ce qui existe déjà (version IA, bascule original/IA).
- **Cinq consignes toutes prêtes** (`IA_PRESETS`) : lumière équilibrée, couleurs fidèles,
  désencombrer, fenêtres dégagées, netteté et matières. Taper trois lignes de français sur un
  téléphone est le vrai frein à l'usage.
- Solde en **pastille discrète** dans l'en-tête de carte, plus en bandeau.

**Ne pas casser** :
- Les onglets sont en `flex:1 1 auto` + `white-space:nowrap` : à parts égales, « ✨ Retouche »
  passait sur deux lignes dans le panneau de 340 px du bureau.
- `paintEditorTabs()` est appelé **à l'ouverture** de l'éditeur, pas seulement au changement
  d'onglet : sans ça les boutons de réglage photo restaient visibles sous l'onglet IA.
- Le libellé du bouton principal (« ✨ Retoucher cette photo ») est répété dans `setBtn` de
  `applyIaToPhoto` : changer l'un sans l'autre laisse un libellé faux après un envoi.

## Galerie — ordre, titres et légendes, remplacement, import lisible (septembre 2026)

**État** : livré, testé, fusionné sur `main`. Chantier `ph09` du tableau des chantiers, plus
ce qui manquait autour pour que la galerie se suffise sans rien demander.

**Constat de départ** : la galerie savait importer, retoucher, sélectionner, télécharger et
publier — mais pas **ranger**, pas **nommer**, pas **remplacer**, et un import ne disait ni
où il en était ni pourquoi un fichier n'était pas entré.

### Ce qui a été ajouté

- **Ordre des photos** (`rzToggleOrderMode`, `rzMovePhoto`, `rzMovePhotoBefore`,
  `makeTileDraggable`). Glisser-déposer à la souris **et** ◀ ▶ au doigt : le HTML5
  drag-and-drop ne fonctionne pas au tactile, et la moitié de l'usage se fait au téléphone.
  Rang affiché sur chaque vignette, ★ sur la couverture, « Trier par date d'ajout » avec
  confirmation.
- **`p.caption`** (nouveau champ) et `p.name` devenu éditable — `openPhotoTextDialog`.
- **`replaceOnePhoto` / `rzReplacePhoto`** : remplacer le fichier d'une photo en gardant son
  identité (id, rang, titre, légende).
- **Import** : `importOnePhoto`, `photoFileRefus`, `photoFileRaison`, `paintImportProgress`,
  `buildImportPanel`. Progression pendant l'envoi, bilan des refus qui reste à l'écran.
- **`openPhotoMenu`** : les actions qui ne tiennent pas sur une vignette de 160 px.
- **Éditeur** : `edGoto(±1)`, rang affiché, bloc `#ed-photo-meta` visible quel que soit
  l'onglet.

### Décisions, et pourquoi

- **La légende part sur le site, le titre non.** Le titre est le nom du fichier de
  l'appareil photo dans l'immense majorité des cas (`IMG_4821.jpg`) : le publier serait une
  fuite d'information sans intérêt. Un test vérifie qu'il n'apparaît pas dans le manifeste.
- **Réordonner marque TOUTE la réalisation « à republier ».** La publication écrit
  `p0.jpg`, `p1.jpg`… dans l'ordre du tableau : déplacer une photo change l'adresse publique
  de toutes celles qui suivent. Ne marquer que la photo déplacée mentirait sur l'état du site.
- **Le remplacement supprime la version IA et les réglages.** Ils ont été calculés sur
  l'ancienne image ; les garder afficherait l'ancienne photo sous un nouveau nom, ou
  appliquerait un redressement calculé pour une autre géométrie. C'est écrit dans la
  confirmation, pas fait en douce.
- **Le format 3/2 est descendu de `.rz-ph` à `.rz-ph-vue`.** La tuile porte maintenant un
  pied de texte (titre + légende) ; laisser l'aspect sur la tuile aurait écrasé la photo.
- **Refus d'import : un message par fichier, avec la raison.** Le cas HEIC (photos d'iPhone)
  donne la manip exacte : c'est le refus le plus probable et le plus incompréhensible.

### Ne pas casser

- `_glTexKey=''` dans `replaceOnePhoto` : la texture WebGL est mise en cache sous une clé
  dérivée de l'identifiant de la photo, qui ne change pas au remplacement. Sans cette remise
  à zéro, l'ancienne image reste affichée.
- `_imgCache.delete(fullKey/thumbKey/iaKey)` au remplacement, pour la même raison côté
  images décodées.
- Le rang (`.rz-ph-num`) et le bandeau « couverture » occupent le même coin : en mode
  « ranger », c'est l'étoile du rang qui porte l'information, le bandeau est masqué. Les
  réafficher ensemble les fait se chevaucher à 160 px.
- `console.error('import photo', …)` sur un fichier illisible est **voulu** (diagnostic à
  distance) ; le filtre de bruit du test le connaît.

### Vérification

`tests/realisations.test.mjs` : **183 contrôles** (45 ajoutés ici), dont l'ordre réellement
publié dans le manifeste, la légende publiée / le titre non publié, le remplacement qui
change vraiment les octets stockés, et chaque message de refus d'import.
`tests/site.test.mjs` : **22 contrôles**, dont l'affichage de la légende sous la photo et en
plein écran. Son banc d'essai est désormais construit par `tests/sitetest-build.mjs` — il
n'existait nulle part et le test ne pouvait plus être lancé sans le refabriquer à la main.

## Retouche IA — la série (septembre 2026)

**État** : livré, testé, fusionné. Chantier `ph05`.

Une consigne, écrite une fois, passée sur toutes les photos d'un chantier. Le pont
`photo-ia` et `runIaEdit` sont réutilisés tels quels ; ce chantier n'ajoute que la boucle,
les garde-fous de coût et l'interface.

**Points de conception**

- **`iaStoreResult(r,photo,data,consigne,modelId)`** : la pose du résultat sur une photo est
  désormais écrite une seule fois, partagée par `applyIaToPhoto` (photo seule) et
  `runIaSerie` (et, depuis, la reprise d'une demande en file). C'est la règle qui décide la
  version posée, ses réglages, la version active et
  l'historique — deux copies auraient dérivé en silence.
- **Le coût est annoncé avant, pas après.** `iaSerieCandidats` + le récapitulatif donnent le
  nombre d'appels, le coût estimé (`coutUnitaire` des réglages) et le cumul du mois. Si le
  plafond doit tomber au milieu, c'est dit avant de lancer.
- **L'interruption s'arrête APRÈS la photo en cours.** On ne peut pas rappeler un appel déjà
  parti : il sera facturé quoi qu'il arrive, autant en garder l'image. Le bouton l'écrit
  (« Arrêt après la photo en cours… ») au lieu de laisser croire à un arrêt immédiat.
- **La portée par défaut est « sans version IA »** : relancer une photo déjà retouchée coûte
  un appel de plus pour un résultat qu'on a déjà. « Toutes » reste à un clic.
- **Un échec n'arrête pas la série.** Chaque photo est indépendante ; le bilan de fin nomme
  les échecs avec la raison exacte du fournisseur et reste affiché.

**Ne pas casser**

- Le bilan de série porte `rz-bilan-serie` en plus de `.ia-erreur` (le bilan d'import a la
  même apparence) : les deux doivent rester distinguables.
- `console.error('retouche IA série', …)` est volontaire (diagnostic) ; le filtre de bruit
  du test le connaît.
- ~~Le mode reste synchrone~~ — **fait** (septembre 2026, chantier `ph14`) : la série passe
  désormais par la file d'attente de fal, comme la retouche unitaire. Voir la section
  « Retouche IA — la file d'attente » plus bas. La consigne « rester en 2K » tient toujours,
  mais pour d'autres raisons (résolution d'envoi et de publication, coût, place).

**Vérification** : 24 contrôles ajoutés dans `tests/realisations.test.mjs` (207 au total),
avec le pont intercepté — les tests ne dépensent aucun crédit.

## Retouche IA — la file d'attente de fal (septembre 2026)

**État** : livré, testé, déployé. Chantier `ph14`.

**Le défaut corrigé** : le pont appelait `POST fal.run/<modèle>` et attendait la fin dans la
requête. Sur une image lourde ou une file chargée, la fonction serveur expirait AVANT la
réponse : l'image était perdue et l'appel facturé quand même — le modèle avait tourné. C'est
ce qui interdisait le 4K et rendait la série (qui multiplie les appels longs) risquée.

**Formes HTTP — relevées, pas devinées.** Le `openapi.json` que fal publie par modèle
(`https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=…`, déjà utilisé par le pont pour
les réglages) déclare `servers: [{url:"https://queue.fal.run"}]` et quatre chemins. Vérifié
sur `fal-ai/nano-banana-pro/edit`, `fal-ai/flux/dev` et `fal-ai/flux-pro/kontext` :

| geste | appel |
|---|---|
| déposer | `POST https://queue.fal.run/<modèle>` → `{request_id, status_url, response_url, cancel_url, queue_position}` |
| suivre | `GET …/requests/<id>/status` → `{status: IN_QUEUE \| IN_PROGRESS \| COMPLETED, queue_position}` |
| récupérer | `GET …/requests/<id>` |
| annuler | `PUT …/requests/<id>/cancel` → 202 `CANCELLATION_REQUESTED`, 400 `ALREADY_COMPLETED`, 404 `NOT_FOUND` |

**Attention** : la page de documentation rédigée de fal donne l'URL de résultat en
`/requests/<id>/response`, le schéma réellement publié dit `/requests/<id>`. Le pont suit
**en priorité les URL que fal renvoie lui-même à la soumission**, et le chemin construit
seulement en repli — la contradiction n'a donc pas d'effet.

**Architecture**

- Pont (`supabase/functions/photo-ia`) : quatre actions `submit` / `status` / `result` /
  `cancel`. Chacune est un aller-retour court : plus rien ne dépend de la durée du modèle.
  L'action `edit` (synchrone) reste pour les pages ouvertes sur l'ancienne version.
- `safeQueueUrl(donnée, repli)` : une URL rendue par le CRM n'est suivie que si elle est en
  `https` sur l'hôte `queue.fal.run`. Sans ce filtre, le pont serait un relais capable
  d'aller chercher n'importe quelle adresse en présentant la clé du compte. `queueBase` et
  `requestPath` refusent les identifiants biscornus. Testé dans `tests/pont-ia.test.mjs`.
- `buildPayload(..., {sync:false})` : `sync_mode` est retiré en mode file (il ferait renvoyer
  l'image en base64 dans la réponse stockée, pour rien), y compris s'il traîne dans les
  réglages mémorisés d'un modèle.
- CRM : `iaSubmitJob` (dépose et **écrit la demande sur le disque avant de rendre la main**),
  `iaWaitJob` (sonde), `iaCollectJob` (récupère, pose, retire), `iaCancelJob`, `iaReprendre`
  (reprise après réouverture). `runIaEdit` enchaîne le tout ; la retouche d'une photo et la
  série passent toutes deux par là.
- `library.iaJobs` : les demandes en vol, synchronisées avec le reste de la bibliothèque —
  une demande déposée depuis le téléphone est récupérable depuis l'ordinateur.

**Points de conception**

- **`iaStoreResult` reste écrite une fois**, appelée d'un seul endroit (`iaCollectJob`) pour
  les trois chemins : photo seule, série, reprise. C'était déjà la règle avec la série ; la
  reprise ne l'a pas dupliquée.
- **Une demande n'est jetée que si on SAIT qu'il n'y a plus rien à récupérer** (`e.definitif`)
  : expirée chez fal, annulée, échec rendu par le modèle. Réseau coupé, serveur muet, délai
  d'attente dépassé → la demande **reste** et sera reprise. Supprimer sur toute erreur
  reviendrait à jeter des images payées.
- **Comptée au dépôt, pas à l'arrivée** : sinon le plafond mensuel ne verrait rien d'une
  série en vol. Décomptée uniquement si fal accepte l'annulation alors que la demande était
  encore en file — le seul cas où rien n'est facturé.
- **L'interruption d'une série a changé de sens.** Avant : « arrêt après la photo en cours »,
  parce qu'un appel parti était facturé de toute façon. Maintenant : la demande en cours est
  annulée si elle n'a pas démarré, et l'écran dit lequel des deux cas s'applique.
- **Le délai d'attente n'est pas un abandon** : passé le délai réglé, le CRM cesse de
  *regarder*. La demande continue chez fal et sera reprise. L'écran le dit mot pour mot,
  sinon la file remplacerait « ça a expiré » par « il ne se passe rien ».

**Réglages ajoutés** (`library.iaSettings`) : `sondageSec` (1-60, défaut 3) et
`attenteMaxMin` (1-120, défaut 10). Refus motivé à l'écran des valeurs hors bornes.

**Déploiement** : `scripts/deploy-fonction.sh photo-ia` (API de gestion Supabase en HTTPS,
jeton dans l'environnement, `verify_jwt:false` conservé). `photo-ia` est en **version 6**.
Garde-fous rejoués sur la fonction en ligne : 401 sans jeton, 401 avec la clé publiable.

**Vérification** : `tests/realisations.test.mjs` **345 contrôles** (46 ajoutés ici),
`tests/pont-ia.test.mjs` **20** (12 ajoutés), `tests/site.test.mjs` 52. Pont intercepté :
aucun crédit dépensé. Ce qui n'est PAS vérifié : une exécution réelle chez fal — elle coûte
de l'argent.

**Reste ouvert** : la série est toujours séquentielle (la file permettrait de tout déposer
d'un coup, mais ça change le sens du plafond et de l'interruption) ; pas de webhook (le CRM
est une page statique, sans adresse publique où recevoir le résultat).

## Plusieurs versions par photo, et le choix de ce qu'on retouche (septembre 2026)

**État** : livré, testé, déployé. Chantier `ph17`.

**Ce qui n'allait pas**, signalé par l'utilisateur : une photo n'avait que deux états —
l'originale et UNE retouche. Relancer une retouche écrasait la précédente sans qu'on puisse
comparer, et l'envoi repartait **toujours** de l'originale. Impossible donc de garder deux
essais, ni d'affiner un résultat en repartant de lui.

**Le modèle de données** — une seule source de vérité par photo :

```
p.versions = [{id, key, model, prompt, params, from, createdAt, label}]
p.active   = 'orig' | <id de version>     celle qui s'affiche, s'exporte et se publie
p.edits    = {orig:{…}, <id>:{…}}          chaque version garde SES réglages manuels
p.edit     = la copie vivante des réglages de la version active
```

`key` est rangée **dans** la version : la toute première garde `ra_<photo>`, la clé de
l'ancien format. Les retouches déjà payées restent donc lisibles sans qu'on recopie un seul
octet. Les suivantes prennent `ra_<photo>_<version>`.

`migratePhotoVersions` fait la conversion au chargement (`normalizeRealisation`) et retire
`ia` / `useIa` / `editOrig` / `editIa` — deux formats qui cohabitent finissent toujours par
diverger.

**Ce qui change à l'usage**

- Une retouche **s'ajoute**, elle n'écrase plus. La dernière produite devient celle qui est
  affichée ; les autres restent à un geste.
- **« À partir de »** dans le panneau : l'originale ou n'importe quelle version. Par défaut,
  celle qu'on regarde — on retouche ce qu'on voit. Une note dit ce que ça implique de
  repartir d'une image déjà redessinée.
- Pile de versions cliquable, avec le modèle, la version dont elle sort, la date et la
  consigne. **Renommer** et **supprimer** (la confirmation dit que l'image est payée).
- La **série** propose le même choix, mais repart de l'originale **par défaut** : enchaîner
  vingt photos sur des sorties déjà redessinées ferait dériver toute la série sans que ça se
  voie.
- Le **comparateur** met en face la version dont sort celle qu'on regarde, pas l'originale
  par principe : comparer la deuxième retouche à l'originale ne dit rien du dernier envoi.

**Ne pas casser**

- **`iaStoreResult` reste le seul endroit qui pose un résultat** — la photo seule, la série
  et la reprise passent par elle. Elle empile une version, elle n'en remplace jamais une.
- **`photoAllKeys(p)`** est la liste des images d'une photo. Suppression de photo, de
  réalisation, de sélection et remplacement s'en servent : un nouveau chemin qui supprime une
  photo doit l'utiliser, sinon des images payées resteront dans le seau sans plus rien pour
  les nommer.
- **L'archive de sauvegarde emporte TOUTES les versions**, et son index porte désormais la
  clé réelle (`cle`). Les archives faites avant retombent sur l'ancienne règle (une seule
  retouche) : ne pas retirer ce repli.
- **Supprimer une version rattache ses descendantes à sa propre origine** : sans ça, leur
  champ `from` désignerait une version disparue.
- Le panneau porte maintenant **deux listes déroulantes** (le point de départ, puis le
  modèle). La liste des modèles porte `ia-model-sel` — un `querySelector('select')` nu
  attrape la mauvaise.
- La pile de versions est posée **avant** la carte du modèle (`insertBefore`) : dès qu'une
  photo a plusieurs versions, c'est elle qu'on vient regarder.

**Vérification** : `tests/realisations.test.mjs` **376 contrôles** (31 ajoutés ici), dont la
migration de l'ancien format sans recopie d'image, deux retouches qui coexistent avec deux
fichiers distincts, le point de départ réellement respecté (l'image envoyée n'est pas la même
selon la version choisie), les réglages qui suivent leur version, le comparateur en chaîne,
le renommage, la suppression et le rattachement des descendantes. Pont intercepté : aucun
crédit dépensé. Parcours réel en 390 px sur la pile de versions.

**Reste ouvert** : rien ne limite le nombre de versions. À une image d'environ 1 Mo, cinq
essais sur vingt photos font 100 Mo sur un plan de 1 Go — c'est l'alerte de saturation
(`fi01`) qui le dira. Un ménage automatique n'a pas été mis : supprimer sans qu'on le demande
une image qui a été payée serait pire que le problème.

## Savoir ce qu'on regarde dans l'éditeur (septembre 2026)

**État** : livré, testé, déployé. Chantier `ph18`.

**Signalement** : « ça m'affiche que c'est la photo originale alors que ce n'est pas la photo
originale ; quand je clique dessus, ça monte une autre photo ».

**Diagnostic, lu en base** : la photo portait `rot:12` (rotation manuelle, valeur maximale du
curseur), zéro version et un historique vide. `iaUsage` du mois = 6 appels pour 6 versions
réellement posées sur les autres photos, `iaJobs` vide : **aucun appel perdu ni facturé pour
rien**. La retouche de cette photo n'avait jamais été lancée, et les « deux images » étaient
la même photo avec et sans les 12°. `autoEdit` ne touche jamais `rot` : le réglage venait
d'un curseur poussé à la main.

**Ce qui a changé**

- `editEstNeutre(e)` et `editResume(e)` : savoir s'il y a des réglages manuels, et **les
  nommer en français**. Une seule écriture de cette règle.
- `edBuildEtat(host)` : une ligne en tête de **tous** les onglets — « À l'écran : <version> +
  vos réglages (rotation 12,0°) » — et le bouton **↺ Annuler mes réglages**, qui dit ce qu'il
  efface avant de le faire.
- **L'appui long est supprimé.** `edHasCompare()` est vrai dès qu'il y a une autre version
  **ou** des réglages manuels ; le curseur avant/après sert aux deux. Quand il n'y a que des
  réglages, le partage n'est peint que pendant le geste (`_ed.glisse`) : sinon on réglerait
  l'exposition sur une moitié de photo.
- L'indice de geste quitte `.ed-bar` pour le panneau. Il y était masqué sous 680 px
  (`@media`) parce que la barre doit tenir sur une ligne : le seul endroit où il était écrit
  était donc invisible sur téléphone.
- La liste « À partir de » est masquée tant qu'il n'y a aucune retouche.

**Ne pas casser**

- Partage **permanent** avec une autre version en face, **transitoire** avec de simples
  réglages : c'est `_ed.imgAlt` qui décide, pas un réglage.
- Ne pas remonter l'indice dans `.ed-bar` (une ligne, 56 px, mesuré à 375 et 390 px).
- `editResume()` reste la seule façon de nommer un réglage manuel.

**Vérification** : 393 contrôles (7 ajoutés), dont le cas exact signalé rejoué à 390 px — une
photo sans retouche portant `rot:12`, la ligne d'état, la visibilité de l'indice, la liste
masquée, et la remise à zéro.

## Stockage — alerte de saturation (septembre 2026)

**État** : livré. Chantier `fi01`.

**Défaut trouvé en chemin** : `loadDocStorageUsage` ne listait que `client-docs`, et sur un
seul niveau. Tout ce qui est publié sur le site (seau `galerie`, rangé en sous-dossiers par
réalisation) n'était pas compté. La jauge annonçait donc systématiquement moins que la
réalité — au moment précis où le chiffre compte.

**Architecture** : `bucketBytes(bucket,prefix,profondeur)` descend dans les sous-dossiers
(une entrée sans `metadata` est un préfixe chez Supabase), `loadStorageStat` additionne les
deux seaux et met le résultat en cache deux minutes, `storageInvalidate()` le périme après
un import, une suppression, une publication ou un retrait.

**Choix** : la place restante est annoncée **en photos**, pas en méga-octets. « Il reste
environ 258 photos » se décide ; « il reste 276 Mo » se calcule. La moyenne utilisée est
celle des fichiers réellement stockés (une photo de téléphone ne pèse pas pareil d'un
appareil à l'autre) ; la valeur de repli (1,2 Mo) ne sert que si moins de quatre fichiers
existent.

**Réglages** : `library.storage = {quotaMo, seuil, photoMo}` dans Sauvegarde →
Synchronisation. Valeurs invalides refusées à l'écran avec leur raison.

## Réalisations — textes de présentation (septembre 2026)

**État** : livré, déployé (CRM, site vitrine, fonction serveur v11). Chantier `si03`.

`normalizeRealisation` porte quatre champs de plus : `lieu`, `surface`, `mission`, `texte`
(`date` servait déjà d'année). Ils partent dans le manifeste **seulement s'ils sont
remplis** — le site s'appuie dessus pour n'afficher aucune étiquette vide.

**Rédaction assistée** : `redigerTexteRealisation` appelle `embellish` avec
`kind:'realisation'`. La fonction serveur porte désormais deux prompts et un seul chemin
vers Anthropic (`appelAnthropic`) ; `kind` absent = prompt des devis, mot pour mot
l'ancien. Déployée en version 11 avec `verify_jwt:false` (inchangé), vérifiée sur l'URL de
production : 401 sans jeton, 401 avec la clé publiable.

**Limite assumée** : le texte réellement produit n'a pas pu être jugé (il faut une session
connectée). Ce qui est testé : la forme de la requête, le retour dans le champ, l'échec
lisible qui ne détruit pas le texte existant.

## Site vitrine — aperçu de partage et référencement (septembre 2026)

**État** : livré, déployé. Chantier `si05`.

**Le fait qui commande tout** : les robots d'aperçu (WhatsApp, Facebook, LinkedIn,
Instagram) n'exécutent pas le JavaScript. Une page qui charge ses données au runtime ne peut
donc pas leur montrer une image « du dernier projet » par du code. D'où le choix : une
**adresse fixe** (`ownerId/share.jpg`) écrite dans le HTML, et le CRM qui dépose à cette
adresse la couverture de la réalisation publiée à chaque publication.

- `shareImagePath()` (CRM) et la balise `og:image` (site) doivent rester d'accord.
- L'upload est dans un `try` : la galerie est déjà publiée quand il a lieu, une panne
  d'aperçu ne doit pas faire échouer la publication.
- Le retrait du dernier projet efface l'image : sinon un lien partagé montrerait une photo
  retirée du site.
- `majSeo()` met à jour titre, description, og:url et canonique à l'ouverture d'un projet, et
  restaure ceux du site (image comprise) à la fermeture.

**Non fait, et pourquoi** : un aperçu *par projet* demanderait une page HTML par projet, donc
un générateur qui republie le dépôt du site à chaque publication — un jeton GitHub à créer et
à stocker. Écarté : une manip et un secret de plus pour un gain marginal.

## Site vitrine — catégories, à propos, contact (septembre 2026)

**État** : livré, déployé. Chantiers `si02` et `si04`.

**Catégories** (`r.categorie`) : champ libre avec propositions (`RZ_CATS` + tout ce qui a
déjà été tapé, via `rzCatsConnues()`). Publié dans le manifeste ; le site en fait un filtre
qui se construit tout seul et disparaît sous deux catégories. Distinct du **type de
mission** : on filtre par lieu, on décrit par mission.

**Ce que le site dit de lui-même** (`library.site`, panneau « ⚙ Le site public ») :
sous-titre, à propos, e-mail, téléphone, Instagram. `siteInfos()` n'écrit que les champs
remplis ; `emptyManifest()` s'en sert, donc une publication de réalisation les rafraîchit
aussi. `pushSiteInfos()` met à jour **le seul bloc `site` du manifeste** — corriger un texte
n'oblige pas à republier un chantier.

**Règle de conduite inscrite dans le code** : aucune coordonnée n'est recopiée depuis les
devis sans un clic explicite, et rien n'est publié sans le bouton « Mettre à jour le site ».
Publier un e-mail ou un numéro est une décision de l'utilisatrice, pas un défaut technique.
Ne pas « simplifier » en synchronisant automatiquement avec `library.branding`.

**Anti-collecte, sans mentir sur sa portée** : le lien `mailto:` est fabriqué au chargement,
l'adresse n'est pas dans le HTML servi. Le manifeste, lui, est public : ce n'est pas un
secret, c'est un ralentisseur.

## Sauvegarde complète (septembre 2026)

**État** : livré. Chantier `fi02`.

Archive `.zip` « store » écrite par `buildZip` (déjà là) et relue par `readZip` (nouveau,
lit le répertoire central — seule table fiable). Contenu : `donnees.json` (la sauvegarde
JSON habituelle), `LISEZ-MOI.txt`, `photos/<réalisation>/<NN>-<titre>.jpg` (+ `-ia.jpg`), et
`photos/_index.json` qui relie chaque fichier à sa photo pour la restauration.

- `donneesSauvegarde()` / `appliquerSauvegarde()` : une seule définition de ce qu'on écrit et
  de ce qu'on relit, partagée avec l'export/import JSON.
- Le poids annoncé avant de lancer vient de la taille moyenne **réelle** des fichiers
  (`_storageStat`), pas d'une constante.
- Export interruptible, `await setTimeout(0)` entre deux photos pour ne pas figer l'écran
  d'un téléphone.
- `readZip` refuse une entrée compressée avec un message qui dit la vraie cause.

**Vérification** : l'archive produite est relue par `unzip -t` dans le test (pas seulement
par notre propre code), puis un aller-retour complet efface tout et restaure.

## Navigation mobile — barre d'onglets en bas (septembre 2026)

**État** : livré. Chantier `qu01`.

En dessous de **820 px** : `.viewnav` masquée, `<nav class="navbas">` fixe en bas (48 px),
`#split-toggle` et `.toolbar-actions` remplacés par un bouton `⋯` (`menuPlusMobile`), menu
« Devis » posé en fenêtre (`devisMenuMobile`) puisque le menu déroulant du haut est invisible.
Barre du haut mesurée à **56 px sur une ligne** contre 87 auparavant.

**Ne pas casser**

- `showView()` synchronise les DEUX navigations (haut et bas). Sans ça, un changement de
  taille d'écran laisse un onglet actif faux.
- Les sélecteurs `.toolbar #split-toggle`, `.toolbar .toolbar-actions` et
  `#rz-body .rz-selbar` sont volontairement plus spécifiques : les règles d'origine sont
  écrites plus bas dans la feuille et gagneraient à spécificité égale.
- `.rz-selbar` remonte au-dessus de la barre d'onglets sur mobile, sinon ses boutons sont
  inatteignables. Un test le mesure.
- `body{padding-bottom:56px+safe-area}` sur mobile : sans ça, le dernier élément de chaque
  vue passe sous la barre.

## Retouche IA — l'écran remis dans l'ordre de l'action (septembre 2026)

**État** : livré et déployé. Retours de Raphaël après un vrai passage sur son téléphone,
sur des photos de bureaux réelles.

**Ce qui n'allait pas** : « je n'arrive toujours pas à comprendre où est le grand bouton
principal ». Le panneau était construit dans l'ordre du code — consigne, puis bouton, puis
choix du modèle — donc on lançait une dépense avant d'avoir vu avec quoi, et le bouton se
retrouvait au milieu de l'écran, noyé sous six lignes de gris expliquant que le solde
n'était pas lisible.

**Ce qui a changé**
- L'écran suit l'ordre de l'action : le **modèle d'abord**, la consigne ensuite, le gros
  bouton après tout ce qui l'alimente.
- **Favoris** : une étoile à côté de la liste ; les modèles étoilés remontent dans un
  groupe « ★ Favoris » en tête. Ils restent aussi dans leur rubrique — déplacer un modèle
  qu'on avait appris à trouver ailleurs coûte plus cher que de le voir deux fois.
- La **confirmation annonce la dépense** : quelle version part, à quel modèle, le coût
  estimé, et où on en est du plafond du mois.
- Le message de solde tient en une phrase ; le mode d'emploi passe derrière un bouton.
- `askInfo` : une explication qu'on lit puis qu'on ferme, distincte d'`askConfirm` (un
  `askConfirm` à un seul bouton ferait croire qu'on valide quelque chose).

**Le solde : la cause est traitée, il reste une manip.** Le pont lit désormais une clé
**dédiée** `FAL_ADMIN_KEY` pour la facturation, séparée de `FAL_KEY` qui fait tourner les
modèles. fal sépare deux portées : API (consommer les modèles) et ADMIN (plateforme, dont
le solde). Remplacer `FAL_KEY` par une clé ADMIN aurait fait dépendre TOUTE la retouche
d'une clé plus puissante que nécessaire, et une erreur dessus aurait cassé la retouche pour
un chiffre d'affichage. Fonction `photo-ia` déployée en **version 7**, vérifiée en ligne :
elle refuse toujours les appels anonymes (HTTP 401).

**Ne pas casser**
- La **raison** d'un échec de solde doit rester lisible À L'ÉCRAN, pas derrière un geste.
  Elle avait été mise dans une infobulle, inatteignable au doigt ; un test l'impose
  (il exige les mots « ADMIN » et « retouche » dans le texte visible). Le mode d'emploi de
  la réparation, lui, peut être derrière un bouton — ce n'est pas la raison.
- `FAL_ADMIN_KEY` est **facultative**. Son absence ne doit jamais empêcher la retouche :
  sans elle, le pont retombe sur `FAL_KEY`, échoue proprement en 403 et le dit en clair.
- Un favori ne doit pas retirer le modèle de sa rubrique d'origine.
- Le test remet le réglage `confirmer` **exactement comme il l'a trouvé** : le laisser à
  `false` désarmait la confirmation pour les tests suivants, qui vérifient justement
  qu'elle s'affiche. Une première version l'a fait, et a fait échouer un test sans rapport.

**Déjà en place, donc non refait** : les réglages proposés sous « Réglages avancés du
modèle » sont **déjà** construits à partir du schéma du modèle choisi, lu chez fal.ai à
chaque changement de modèle (`iaSchema`). Un modèle qui ne prend pas de consigne désactive
le champ texte et le dit, au lieu d'exiger un texte qui serait ignoré. La question « est-ce
que les champs sont les mêmes pour chaque modèle ou spécifiques ? » a donc déjà sa réponse
dans le code : ils sont spécifiques et dynamiques.

**Vérification** : `tests/realisations.test.mjs` (9 nouveaux contrôles — l'ordre mesuré sur
la position réelle à l'écran, l'étoile qui remonte vraiment le modèle en tête, le favori
qui survit à une reconstruction du panneau, le coût annoncé avant l'envoi) et
`tests/pont-ia.test.mjs`, 20 contrôles. Aucun crédit dépensé : le pont est intercepté.

**Notes / À faire**
- [x] Favoris de modèles.
- [x] Choix du modèle remonté au-dessus de la consigne.
- [x] Coût et plafond annoncés avant l'envoi.
- [x] Champs dynamiques par modèle — déjà en place, vérifié.
- [x] Clé ADMIN séparée pour le solde, côté serveur, déployée.
- [ ] **Manip utilisateur, non automatisable** : créer sur fal.ai une clé de portée ADMIN
      (fal.ai → Keys → scope ADMIN) et la déposer dans Supabase → Edge Functions → Secrets
      sous le nom `FAL_ADMIN_KEY`. Ne pas toucher à `FAL_KEY`. Rien à redéployer ensuite.
      Tant que ce n'est pas fait, le solde affiche « n/c » — sans effet sur la retouche.
- [ ] Suivi d'avancement pendant la génération : la file d'attente vient d'être livrée par
      une autre session (état sur le bouton, annulation possible, reprise à la réouverture).
      Raphaël demandait « vérifier qu'il y a bien les chargements de l'action » — à
      reregarder avec lui sur l'écran réel avant d'y toucher, pour ne pas refaire ce qui
      existe déjà.
