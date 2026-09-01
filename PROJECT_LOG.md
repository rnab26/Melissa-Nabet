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
- [x] Ajustements après retour : "Général" fusionné dans la colonne gauche sous Email (ville/début/fin/commentaire, sans titre "Général" — coordonnées de base) ; Relance client déplacée entre Paiements et Commissions ; Devis-montant et Commissions encadrés (`.cl-subbox`) comme Tâches liées ; phrase "choisissez la catégorie" remplacée par des en-têtes de colonnes (Catégorie/Intitulé/Montant/Date) ; phrase "Reste = montant final…" supprimée ; icône 🗑 sur "Supprimer ce client".

## Nettoyage de code

**État** : passe de nettoyage effectuée une fois (code mort supprimé — dont des données clients réelles codées en dur —, CSS dupliqué fusionné, `pickImageFile()` factorisé pour les 7 imports d'image).

**Notes / À faire**
- [x] Nettoyage code mort + CSS dupliqué + factorisation import image.
- [ ] Repasser dessus périodiquement si le fichier continue de grossir.
