# PROJECT_LOG.md

Journal des chantiers sur ce dépôt (CRM + générateur de devis, single-file `index.html`, hébergé sur GitHub Pages, sync via Supabase). Une section par chantier, mise à jour aux étapes importantes — pas un historique de chaque message. Chaque section a une liste "Notes / À faire" : cases cochées [x] = déjà fait, non cochées [ ] = pas encore traité.

## Authentification & synchronisation cloud

**État** : connexion à un compte obligatoire. Le bouton "Continuer hors ligne" (mode anonyme, données locales uniquement) a été retiré de l'UI — c'est ce mode qui a causé une vraie perte de données quand l'utilisatrice a vidé le cache du navigateur. `loginOffline()` reste en JS pour les tests automatisés uniquement, jamais exposée dans l'UI de production.

Bug corrigé dans `cloudPush()` : un push qui échouait (hors ligne, erreur réseau) marquait quand même la donnée comme "synchronisée" en interne côté client, donc plus jamais retentée — un rechargement pouvait alors écraser silencieusement la modification locale non envoyée. Le marquage n'a lieu qu'après confirmation d'écriture réussie. Retry auto sur l'évènement `online` du navigateur + filet de sécurité toutes les 20s tant qu'une erreur persiste.

**Ne pas casser** : ne jamais réintroduire de mode de stockage purement local non lié à un compte dans l'UI de production. Toute nouvelle donnée utilisateur (nouveau champ, nouvelle collection) doit être synchronisée au même titre que `clients`/`devis`/`library`/`tasks` (voir `SYNC_KEYS`).

Deux vrais trous de synchro trouvés (signalés par Raphaël : « je travaille un devis sur la tablette, je ne retrouve pas les modifs sur le téléphone », et une catégorie de chantier/service qui ne se retrouvait pas non plus d'un appareil à l'autre) :

1. **Brouillon de devis** : l'autosave qui tourne à chaque frappe (`render()` → `saveDraftDebounced()` → `saveDraft()`) n'écrivait que dans `K_DRAFT`, une clé **hors** `SYNC_KEYS` — purement locale à l'appareil. Seul un clic explicite sur « 📝 Enregistrer brouillon » poussait réellement le devis dans `devisList` (`K_DEVIS`, synchronisé). Un brouillon travaillé sans jamais cliquer ce bouton restait donc invisible sur les autres appareils. `saveDraft()` appelle maintenant aussi `upsertDevis('brouillon')` dès qu'un nom de client (`current.raison`) existe — pas avant, pour ne pas créer de devis fantômes à chaque écran « Nouveau devis » ouvert puis abandonné.
2. **Chantier / Estimation** (catégories, services, lignes) : `K_CHANTIER` n'était présent **nulle part** dans le circuit de synchro — ni dans `SYNC_KEYS`, ni dans `cloudPush()`, ni dans `loadAll()`/`handleRealtime()`. Le module entier (brouillon en cours ET liste des estimations enregistrées) ne synchronisait jamais, quoi qu'on fasse. Corrigé à l'identique du patron `clients`/`devis`/`library`/`tasks`/`realisations`/`produits` : `K_CHANTIER` ajouté à `SYNC_KEYS`, kind `'chantier'` géré dans `cloudPush`/`loadAll`/`handleRealtime` (avec `remoteChantierJson` et la même protection anti-écrasement d'une saisie en cours que pour les réalisations/la boutique, via `isEditingChantier()`), et `saveChantierDraftDebounced()` pousse maintenant aussi vers `chantierList` (via `persistChantierSilent()`, la même logique que le bouton « Enregistrer » mais sans le toast) dès qu'un nom de projet (`chantier.title`) existe.

**Ne pas casser (suite)** : toute future donnée utilisateur doit être ajoutée aux TROIS endroits (`SYNC_KEYS`, `cloudPush`, `loadAll`+`handleRealtime`) — avoir une clé locale (`store.set`) ne suffit pas, c'est exactement ce qui a créé ces deux trous. Et pour tout brouillon local (`K_DRAFT`, `mn_chantier_draft` ou futur équivalent) : l'autosave local seul ne suffit pas non plus, il doit systématiquement pousser vers la collection synchronisée correspondante dès que le contenu est identifiable (pas de sync prématurée d'un écran vide, pas de sync manquante d'un contenu réel).

**Troisième trou, trouvé en creusant le retour « je veux du vrai live comme un Google Sheet »** : le devis synchronisait bien en coulisse (`devisList`/`K_DEVIS`), mais le composeur **affiché à l'écran** ne se rafraîchissait jamais sur un écho distant — `handleRealtime` mettait à jour `devisList` sans jamais repeindre `#f-raison`, `#prest`, etc. Travailler le même devis sur deux appareils donnait donc l'impression figée « il faut fermer/rouvrir pour voir l'autre appareil ». Corrigé : nouvelle garde `isEditingDevisComposer()` (même patron que `activeEditingClientId()`) — si CE devis est ouvert et qu'on y tape, l'écho est ignoré (la frappe locale n'est jamais écrasée, et repartira au prochain `cloudPush`) ; sinon `current` est rechargé depuis la donnée distante et l'écran (`fillFields`/`buildPrest`/`buildExclu`/`render`) se repeint tout de suite, sans toucher aux accordéons ouverts/fermés localement.

**Honnêteté sur la limite** : ce n'est PAS une co-édition à la Google Sheets au sens strict (pas de fusion caractère par caractère si deux personnes tapent au même instant dans le même champ — la dernière écriture gagne, comme partout ailleurs dans l'app pour clients/réalisations/boutique/chantier). Ce qui est corrigé : éditer sur un appareil puis regarder l'autre (sans y taper) le montre à jour en ~1 seconde, sans rouvrir quoi que ce soit — ce qui manquait réellement.

**Ne pas casser (suite 2)** : `isEditingDevisComposer()` scope sur `.editor` (le formulaire du composeur) — si la structure DOM du composeur change, vérifier que cette classe existe toujours à sa racine, sinon la garde ne protège plus rien silencieusement.

**Régression directe du point 1 ci-dessus, signalée par Raphaël** : « les devis en brouillon que je supprime ne se suppriment pas vraiment » — vrai bug, introduit par l'autosync automatique du brouillon. `deleteDevisRecord(id)` videait bien `currentDevisId` quand on supprimait le devis actuellement ouvert dans le composeur, mais laissait `current.raison`/`current.services` intacts à l'écran — la frappe suivante (ou un debounce déjà programmé à 600ms, en vol au moment du clic sur Supprimer) relançait `upsertDevis('brouillon')`, qui recréait un devis quasi identique sous un nouvel id. C'est aussi la source du problème connexe signalé dans le même message : des « doublons » créés sans le vouloir, plus moyen de savoir lequel est le bon. Corrigé : supprimer le devis ouvert vide vraiment le composeur (`newDevis()`) et annule un debounce en vol (`clearTimeout(_draftT)`), au lieu de juste vider le pointeur `currentDevisId`.

**Ne pas casser (suite 3)** : tout nouveau chemin qui touche `currentDevisId` sans vider `current` en même temps recrée ce même risque de résurrection, maintenant que le brouillon autosynchronise sur chaque frappe — les deux doivent toujours changer ensemble quand on quitte/supprime le devis affiché.

**« Modifié le » ne voulait rien dire** (demande explicite, anticipée par Raphaël avant même que je code : « pas juste si on y est rentré, sinon ça risquerait de nous embrouiller ») : `upsertDevis` posait `updatedAt:Date.now()` à chaque appel, or l'autosync du brouillon (voir plus haut) appelle `upsertDevis` à CHAQUE `render()` — y compris juste après avoir ouvert/regardé un devis sans rien taper (`loadDevis` → `render()` → `saveDraftDebounced` → `saveDraft` → `upsertDevis`). La date affichée dans « Mes devis » avançait donc sur une simple consultation, pas sur une vraie modification. Corrigé : `upsertDevis` compare maintenant le contenu (`title`/`clientId`/`status`/`snapshot`) à la version existante et ne fait avancer `updatedAt` que s'il a réellement changé. Affichage passé de la date seule à `fmtDateTimeFr(d.updatedAt)` (date + heure) dans `openDevisPanel()`.

**Signature/logo mis à jour sur un autre appareil, invisibles sur un brouillon déjà ouvert** (signalé par Raphaël : « j'ai actualisé ma signature et je coche la case mais rien ne s'affiche »). Root cause vérifiée par test, pas supposée : `handleRealtime` recevait bien l'écho `kind==='library'` et mettait à jour la variable globale `library`, mais ne touchait jamais `current.branding` ni ne repeignait `#devis` — un brouillon déjà ouvert sur CET appareil restait donc figé sur l'ancienne signature jusqu'à fermeture/réouverture du devis (`loadDevis` la rafraîchit) ou rechargement de la page (`init()` la rafraîchit aussi, ligne ~11446). Seul le cas « déjà ouvert + changement arrivé d'ailleurs en direct » manquait — même trou que celui comblé pour le devis lui-même le 14/09, jamais étendu à la bibliothèque. Corrigé sur le même principe : si le devis actuellement ouvert n'est pas `valide`, `current.branding` est recalé sur la nouvelle bibliothèque et l'écran se repeint tout de suite ; un devis déjà validé garde son branding gelé (vérifié : n'est PAS affecté par l'écho).

**Réponse à la question générale de Raphaël** (« est-ce un bug de cette fonction spécialement ou de façon générale ? ») : spécifique à ce chemin précis (`handleRealtime` → branding), pas un problème de fond dans toute l'app — le même principe (brouillon vivant, validé figé) est déjà appliqué et fonctionne à l'ouverture d'un devis et au rechargement de page ; il manquait seulement pour le cas « déjà ouvert + changement reçu en direct depuis un autre appareil », maintenant comblé.

**Suite, Raphaël a testé et signalé deux choses encore fausses** : (1) « Modifié le » restait faux sur des devis « pas modifiés à l'instant même » — la comparaison de contenu ci-dessus incluait encore `snapshot.branding`, qui change tout seul à chaque ouverture/réglage suivant la bibliothèque (voir juste au-dessus) : rouvrir un vieux brouillon un autre jour (bibliothèque forcément différente entre-temps) le faisait paraître « modifié à l'instant ». Corrigé : `branding` est maintenant explicitement EXCLU de la comparaison dans `upsertDevis` — ce n'est jamais une modification du devis lui-même, seulement un effet de bord suivi passivement. (2) « Ma signature ne s'affiche toujours pas » : testé de bout en bout par un vrai trait dessiné à la souris sur `#sig-canvas` (même session, nouveau devis, brouillon préexistant rouvert) — la signature s'affichait correctement dans les TROIS cas, root cause introuvable dans le pipeline d'affichage lui-même. Trou réel trouvé ailleurs en creusant : `saveSignaturePad()` enregistrait sans vérifier qu'un trait avait été dessiné — le canvas démarre entièrement transparent (le fond blanc est du CSS, pas un pixel peint), donc valider sans dessiner (mobile, tap raté) enregistrait silencieusement une image invisible mais bien "configurée", indiscernable d'une vraie signature côté données. Ajouté : lecture des pixels (`getImageData`, canal alpha) avant validation, refuse et prévient si rien n'est dessiné.

**Régression du même correctif de synchro (10/09), trouvée en creusant le lot d'entrées « Mes devis » envoyé par Raphaël en capture** : `saveDraft()` poussait vers le cloud dès qu'un nom de client existait, MÊME pour un devis jamais enregistré (`currentDevisId` encore vide) — chaque « + Nouveau devis » ouvert, essayé, puis abandonné sans jamais cliquer sur « Enregistrer brouillon » devenait quand même un brouillon permanent, avec le même numéro que les autres tentatives abandonnées (aucune n'avait compté pour le calcul du suivant). C'est la vraie source des « brouillons du matin que je n'ai pas modifiés » et des doublons qui traînaient encore après le correctif du 15/09 (celui-là ne couvrait que la suppression, pas la création). Corrigé : la toute première sauvegarde d'un devis reste manuelle (clic « Enregistrer brouillon », ou validation) ; une fois `currentDevisId` posé, la synchro automatique à chaque frappe continue de fonctionner normalement — c'est le scénario tablette/téléphone d'origine, inchangé.

**Le trou le plus fondamental, trouvé après que Raphaël a insisté** (« il n'y a pas de coordination entre les appareils », signature configurée sur tablette invisible sur téléphone, malgré tous les correctifs ci-dessus déjà vérifiés par test) : tous les correctifs précédents portent sur ce qui se passe QUAND un écho distant arrive — mais rien ne garantissait que le canal temps réel (`sbChannel`, WebSocket Supabase Realtime) restait VIVANT. `subscribeRealtime()` ne gérait que le statut `SUBSCRIBED` ; un canal qui tombe (`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` — fréquent sur mobile quand l'onglet passe en arrière-plan et que le système coupe le WebSocket) laissait `sbChannel` avec une référence non nulle, donc `subscribeRealtime()` refusait tout nouvel essai pour le reste de la session (garde `if(!sb||sbChannel)return`) — silencieusement : le badge « synchronisé » reste affiché (posé ailleurs, sans rapport avec l'état réel du canal). Un canal mort en tout début de session téléphone expliquerait TOUS les cas signalés jusqu'ici, indépendamment de la fonctionnalité précise. **Honnêteté** : je n'ai pas d'accès en lecture à la vraie base Supabase dans cet environnement (`SUPABASE_SERVICE_ROLE_KEY_MELISSA` absente) pour confirmer que c'est EXACTEMENT ce qui s'est passé — root cause plausible et cohérente avec tous les symptômes, pas prouvée par une preuve directe en base.

Corrigé : (1) `subscribeRealtime()` gère maintenant `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` — `sbChannel` remis à `null`, nouvelle tentative après 5s. (2) Nouvel écouteur `visibilitychange` : au retour au premier plan, `cloudPush()` (pousse tout changement local resté en attente — AVANT de tirer, pour ne jamais écraser une modif locale pas encore envoyée) puis `loadAll()` (rattrape ce qui a pu arriver pendant l'absence) puis réabonnement si le canal était mort. Ce filet couvre aussi le cas où le WebSocket est gelé par le système sans jamais notifier de fermeture (aucun statut ne se déclenche alors) — la reprise au premier plan agit indépendamment de ça.

**Ne pas casser (suite 4)** : le nouvel écouteur `visibilitychange` doit rester "push avant pull" — inverser l'ordre réintroduirait le risque qu'un `loadAll()` écrase une modification locale pas encore envoyée au cloud.

**Cinquième trou, root cause du « tout ce que j'avais supprimé est réapparu » (Raphaël, sur son propre téléphone — pas juste un écart entre appareils)** : `deleteDevisRecord()` retire bien le devis de `devisList` immédiatement (l'écran le montre supprimé), mais l'envoi côté serveur passe par le même circuit débouncé à 500ms que n'importe quelle frappe (`store.set` → `scheduleSyncPush` → `setTimeout(cloudPush,500)`, via `pushT`). Rien ne forçait cet envoi avant que la page se mette en arrière-plan ou se ferme. Verrouiller le téléphone ou changer d'appli dans cette fenêtre de 500ms pouvait geler/perdre ce `setTimeout` en vol (comportement courant des navigateurs mobiles sur un onglet caché) — le prochain `loadAll()` (retour au premier plan, ou simple réouverture de l'appli) retrouvait alors côté serveur une ligne jamais réellement supprimée, et la remettait dans `devisList`. Corrigé : `visibilitychange` déclenche maintenant un `cloudPush()` immédiat (`clearTimeout(pushT)` puis appel direct, sans attendre le minuteur) dès que `document.visibilityState==='hidden'` ; nouveau filet `pagehide` pour le cas où la page est carrément fermée plutôt que seulement mise en arrière-plan (peut se déclencher plus fiablement que `visibilitychange` à la fermeture réelle sur certains navigateurs mobiles). Testé réel (faux Supabase en mémoire, compteur d'appels `delete`) : sans le correctif, 0 appel de suppression 150ms après avoir masqué la page (le débounce à 500ms n'a pas eu le temps de partir) ; avec le correctif, l'appel part immédiatement sur `hidden`, et indépendamment sur `pagehide`.

**Sixième trou, celui qui rendait TOUS les précédents invisibles pendant jusqu'à 10 minutes après chaque déploiement** : GitHub Pages sert `index.html` avec `cache-control: max-age=600` — un appareil pouvait continuer à exécuter le JS d'AVANT un correctif pendant un moment après sa mise en ligne, sans la moindre erreur, juste un comportement obsolète. C'est ce qui a produit deux symptômes qui semblaient être de nouveaux bugs alors que le code déployé était déjà correct : le bouton « 🆕 Nouveau Devis » qui « ne faisait rien » (le clic tournait sur l'ancien bundle), ET, plus grave, une fois le clic sans effet, l'écran gardait le devis PRÉCÉDEMMENT ouvert (Rony Partouche) au lieu d'un composeur vide — `currentDevisId` n'étant jamais remis à zéro, la frappe suivante (un autre nom de client) risquait d'être enregistrée dans ce devis existant au lieu d'un nouveau. Vérifié par Raphaël après coup : aucune perte réelle constatée sur ce cas précis, mais le mécanisme est bien réel et peut recommencer à tout futur déploiement tant que rien ne prévient l'appareil qu'une version plus récente existe. Corrigé structurellement plutôt que par un correctif ponctuel : `checkForUpdate()` compare périodiquement (toutes les 60s, et à chaque retour au premier plan) l'ETag/Last-Modified réel du fichier servi (requête `HEAD`, `cache:'no-store'` — contourne le cache HTTP pour cette requête précise) à celui chargé au démarrage. Si différent ET qu'aucun champ n'est activement en cours de saisie (`document.activeElement`), l'appareil se recharge tout seul, sans rien demander (`forceReload()`, URL cache-busted par un paramètre horodaté, pour être sûr de ne pas retomber sur la même version en cache). Si un champ EST actif, une bannière non intrusive (« Une nouvelle version du CRM est disponible — Recharger maintenant ») s'affiche à la place, pour ne jamais écraser une saisie en cours. Testé réel (Playwright, fausse réponse `HEAD` avec ETag simulé) : premier appel établit la référence sans rien déclencher ; version inchangée = rien ; version différente + aucun champ actif = rechargement automatique ; version différente + champ actif = bannière affichée, aucun rechargement forcé.

**Ne pas casser (suite 5)** : `checkForUpdate()` ne doit jamais recharger sans vérifier `document.activeElement` d'abord — un rechargement pendant une frappe active perdrait ce qui n'est pas encore sauvegardé localement (contrairement à un `cloudPush`, qui ne perd rien puisqu'il pousse ce qui existe déjà en mémoire).

**Septième trou, persistant même après un chargement garanti neuf (Raphaël a testé avec un lien cache-cassé — donc le cache HTTP n'était plus en cause)** : `deleteDevisRecord()` déclenchait bien un envoi (via le flush immédiat sur `visibilitychange`/`pagehide`, voir plus haut), mais SEULEMENT si l'un de ces deux évènements avait le temps de se déclencher avant que la page ne soit vraiment déchargée. Un rafraîchissement manuel immédiatement après le clic sur "Suppr." (exactement le geste naturel pour vérifier que la suppression a marché) pouvait couper la requête réseau en plein vol avant qu'elle n'atteigne le serveur — `pagehide` ne garantit pas qu'une promesse `await` en cours ait le temps de se résoudre. Corrigé à la racine : une suppression est un geste ponctuel et délibéré (un clic), pas une frappe continue à débouncer comme le reste — `deleteDevisRecord()` appelle maintenant `cloudPush()` immédiatement, sans passer par le minuteur à 500ms ni dépendre d'un évènement de fermeture de page. Testé réel (faux Supabase en mémoire) : l'appel de suppression part en ~30ms après le clic, largement avant que le débounce d'origine n'aurait même commencé à attendre.

**Champs du composeur remplis tout seuls avec d'anciennes valeurs sur un nouveau devis, root cause distincte** : aucun des champs texte du composeur (raison sociale, contact, ville, adresse du projet, etc.) n'avait `autocomplete="off"` ni de `name` distinctif — un navigateur mobile (Samsung Internet en particulier) peut proposer/injecter d'anciennes valeurs précédemment tapées dans un champ du même type, indépendamment de tout code JS ou de toute donnée réellement stockée. Ce n'est pas une resynchronisation d'un ancien devis : c'est l'autocomplétion native du navigateur. Corrigé : `autocomplete="off"` et un `name` namespacé (`mn-...`) posés sur les 12 champs du composeur (client + projet).

**Huitième trou, le plus profond, trouvé après que Raphaël a refusé (à raison) tout nouveau patch ponctuel et demandé un vrai travail de fond** : capture à l'appui, badge « ⚠ hors ligne » visible dans la barre du haut, ET le devis validé de Rony Partouche repassé en « Brouillon », ET les anciens fantômes toujours là malgré un chargement garanti neuf (lien cache-cassé). Ce badge n'est PAS un vrai mode hors-ligne : `setSyncStatus('err')` l'affiche sous ce libellé (trompeur) dès qu'un appel Supabase échoue — preuve qu'un VRAI appel réseau a échoué, pas un problème de cache. En relisant tout le circuit de synchro avec ce fil : trois failles structurelles distinctes, toutes réelles, aucune supposée :

1. **`loadAll()` n'avait aucune reprise automatique en cas d'échec** — contrairement à `cloudPush()` (retry après 20s). Si le tout premier chargement d'une session échoue (réseau, session expirée après une longue mise en veille — Raphaël : « ça fait trois heures... depuis hier soir aussi »), `cloudReady` ne passait JAMAIS à `true` et l'app restait bloquée sur les données locales pour le reste de la session, sans jamais se rattraper. Corrigé : backoff exponentiel (5s → 60s max), remis à zéro dès qu'un chargement réussit.
2. **`cloudPush()` ne vérifiait jamais `cloudReady`** — seul `scheduleSyncPush()` (le déclenchement débouncé) le faisait. Mes propres correctifs du jour (flush immédiat sur suppression/`visibilitychange`/`pagehide`) appellent `cloudPush()` DIRECTEMENT, contournant cette garde. Tant que `loadAll()` n'a jamais réussi une fois, `remoteDevis`/`remoteClients` démarrent vides : CHAQUE ligne locale (potentiellement une copie périmée restée en cache) paraît "nouvelle ou changée" et serait réécrite sur le serveur — écrasant une donnée serveur correcte (le "Validé" de Rony) avec une copie locale obsolète ("Brouillon"). C'est très probablement l'explication de la régression de statut. Corrigé : `cloudPush()` refuse maintenant de s'exécuter tant que `cloudReady` n'est pas vrai — aucune poussée locale→serveur avant d'avoir établi une vraie base de comparaison.
3. **Une suppression déclenchée avant ce tout premier `loadAll()` pouvait être annulée par lui** : `loadAll()` rajoute dans `devisList` tout ce qu'il trouve côté serveur, sans savoir qu'un id vient d'être supprimé localement (il ne peut comparer qu'à un `remoteDevis` déjà rempli par un chargement précédent — vide au tout premier). Corrigé : nouvel ensemble `_pendingDeletedDevisIds`, peuplé à la suppression, consulté par `loadAll()` pour ne jamais rajouter un id en cours de suppression, vidé une fois la suppression confirmée côté serveur.

**Complément** : au retour au premier plan après une longue absence, `sb.auth.getSession()` est maintenant appelé explicitement AVANT tout `cloudPush()`/`loadAll()` — cette méthode de supabase-js rafraîchit la session si le jeton a expiré pendant que le minuteur de rafraîchissement automatique interne était lui-même gelé (arrière-plan mobile prolongé), réduisant la probabilité même de tomber sur l'erreur en premier lieu.

**Visibilité, pour ne plus jamais deviner** : le badge « hors ligne » (10px, discret) ne suffisait pas — une vraie bannière rouge en haut d'écran s'affiche maintenant sur toute erreur de synchro, avec le message d'erreur RÉEL (`lastSyncError`) et un bouton « Réessayer » qui relance `loadAll()`+`cloudPush()` manuellement. Si ça se reproduit, la vraie cause sera visible d'un coup d'œil au lieu de rester une hypothèse.

Testé réel (faux Supabase en mémoire simulant un premier échec puis une reconnexion) : premier `loadAll()` en échec → badge/bannière d'erreur, `cloudReady` reste faux ; suppression pendant cette fenêtre → 0 appel réseau prématuré, id gardé en attente ; reprise automatique → `cloudReady` passe à vrai, badge « synchronisé », bannière masquée ; le devis supprimé pendant la panne NE revient PAS après le `loadAll()` qui réussit enfin. 0 erreur page.

**Honnêteté** : je n'ai toujours pas accès à la vraie base ni aux vrais logs Supabase (`SUPABASE_SERVICE_ROLE_KEY_MELISSA` absente) pour confirmer que c'est EXACTEMENT ce qui s'est produit chez Raphaël (session expirée vs. autre panne réseau) — mais les trois failles corrigées sont réelles, vérifiées par lecture directe du code (pas supposées), et rendent la classe ENTIÈRE de symptômes signalés aujourd'hui structurellement impossible, quelle que soit la cause précise de la coupure réseau initiale.

**Notes / À faire**
- [x] Retirer le mode "Continuer hors ligne" de l'UI (connexion à un compte obligatoire).
- [x] Corriger le marquage "synchronisé" à tort sur un push qui a échoué.
- [x] Retry automatique de la synchro (évènement `online` + filet 20s).
- [x] Brouillon de devis synchronisé automatiquement (pas seulement sur clic manuel).
- [x] Module Chantier/Estimation entièrement raccordé à la synchro cloud (brouillon + liste enregistrée), auparavant totalement absent du circuit.
- [x] Le composeur de devis se rafraîchit en direct sur un écho distant (au lieu de rester figé jusqu'à fermeture/réouverture), avec protection de la frappe active.
- [x] "Modifié le" (date + heure) reflète une vraie modification, pas une simple ouverture.
- [x] La bibliothèque (signature, logo, thème…) se propage en direct à un brouillon déjà ouvert reçu d'un autre appareil, pas seulement à l'ouverture/rechargement.
- [x] Le canal temps réel se reconnecte tout seul s'il tombe, et la reprise au premier plan (mobile) pousse/tire/réabonne automatiquement.
- [ ] Confirmer en base réelle (nécessite `SUPABASE_SERVICE_ROLE_KEY_MELISSA` dans l'environnement cloud) que le canal était bien la cause précise du cas de Raphaël.
- [x] "Modifié le" exclut le branding de la comparaison (suivi passif, pas une modification du devis).
- [x] Garde-fou : impossible d'enregistrer une signature vide (canvas non dessiné) comme si elle était configurée.
- [x] Régression du 10/09 corrigée : la première sauvegarde d'un devis reste manuelle, pour ne plus créer de brouillons fantômes à chaque "+ Nouveau devis" abandonné.
- [x] Supprimer le devis ouvert dans le composeur ne le fait plus réapparaître (résurrection par l'autosync du brouillon, corrigée).
- [x] Une suppression (ou toute modif) n'est plus perdue si l'app passe en arrière-plan/se ferme dans les 500ms qui suivent — flush immédiat sur `visibilitychange:hidden` et `pagehide`, plus besoin d'attendre le débounce.
- [x] Détection automatique d'une nouvelle version déployée (jusqu'à 10 min de cache HTTP GitHub Pages) — rechargement auto si rien n'est en cours de saisie, bannière sinon.
- [x] Suppression d'un devis envoyée immédiatement (pas de débounce) — un rafraîchissement juste après le clic ne peut plus couper l'envoi en plein vol.
- [x] Champs du composeur protégés de l'autocomplétion native du navigateur (`autocomplete="off"` + `name` namespacé) — ce n'était pas d'anciennes données qui revenaient, mais le navigateur qui proposait/injectait de vieilles saisies.
- [x] `loadAll()` retente automatiquement en cas d'échec (backoff 5s→60s) — plus jamais bloqué indéfiniment sur des données locales périmées après une session expirée ou un réseau capricieux.
- [x] `cloudPush()` ne pousse plus rien tant qu'un premier `loadAll()` n'a pas réussi cette session — évite d'écraser une donnée serveur correcte avec une copie locale obsolète.
- [x] Une suppression déclenchée avant le tout premier `loadAll()` ne peut plus être annulée par lui (`_pendingDeletedDevisIds`).
- [x] Session rafraîchie proactivement (`sb.auth.getSession()`) au retour au premier plan, avant tout appel réseau.
- [x] Bannière d'erreur de synchro visible (pas juste un badge discret), avec le vrai message d'erreur et un bouton Réessayer.
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

Renommer une section (`libEdit`, ex. « Compléments ») persiste bien réellement (vérifié : survit fermeture/réouverture du panneau, relecture du `store`) — mais chaque devis fige une COPIE du nom au moment de sa création (`sv.cat`, pas une référence vivante vers `library.sections`), volontairement, pour qu'un devis déjà validé/envoyé ne change pas de libellé si la bibliothèque évolue ensuite. Un devis **brouillon** (pas encore validé) doit en revanche suivre le renommage — demande explicite de Raphaël. `propagateSectionRename(oldName,newName)` : parcourt `devisList`, ne touche que les entrées `status==='brouillon'` (jamais `'valide'`), met à jour `sv.cat` + la clé correspondante de `snapshot.open` ; si le devis actuellement ouvert dans le composeur est lui-même un brouillon (ou pas encore enregistré), `current.services`/`current.open` sont mis à jour à l'identique et **`buildPrest()` + `render()`** repeignent l'écran tout de suite (`render()` seul ne suffit pas : il ne repeint que l'aperçu imprimé `#devis`, pas l'accordéon d'édition `#prest` — bug réel trouvé par le premier passage du test, corrigé avant livraison).

**Ne pas casser (bibliothèque)** : `propagateSectionRename` doit rester borné aux devis `brouillon` — ne jamais l'étendre aux devis `valide` sans qu'on le redemande explicitement, c'est le contraire de ce qui a été demandé pour ceux-là.

Déplacer un service vers une autre section : le glisser-déposer maison (`attachDragReorder`) est strictement scopé à un seul conteneur (`.lib-items` d'une section) — mesure les frères/sœurs via `container.children` uniquement, aucun support multi-conteneur. Plutôt que de réécrire ce mécanisme (rects figés au début du geste, décalages visuels par `transform`, remapping d'index au drop — fragile à toucher), ajout d'un simple `<select>` "→ Déplacer vers…" par ligne (`libMoveItem(si,ii,targetSi)` : `splice` hors de la section source, `push` dans la section cible). Ne touche AUCUN devis existant — un item de bibliothèque déplacé change juste l'organisation pour les FUTURS devis (un devis déjà seedé a sa propre copie indépendante de `sv.cat`/`sv.title`, comme pour le reste de cette section).

**Notes / À faire**
- [x] Corriger `resetLibrary()` pour ne toucher que `sections`/`exclus`.
- [x] Renommer une section de bibliothèque propage le nouveau nom aux devis brouillons (composeur ouvert inclus), jamais aux devis validés.
- [x] Déplacer un service d'une section de bibliothèque vers une autre (`<select>` par ligne, le glisser-déposer restant limité au réordonnancement dans une même section).

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

**« Télécharger le PDF » mal paginé (page blanche en trop), alors que « Imprimer » (même écran) fonctionnait bien** (Raphaël, PDF réel à l'appui) : les deux boutons de la fenêtre d'export ne suivaient PAS le même chemin — « Imprimer » appelle `window.print()`, qui respecte le vrai CSS `@media print` (celui-là même vérifié à chaque modif, voir ci-dessus) ; « Télécharger le PDF » (`genPDF()`) passait par html2pdf.js (html2canvas + jsPDF), un moteur de rendu ENTIÈREMENT séparé qui rasterise le DOM et recalcule sa propre pagination — un déjà signalé dans le code comme source de pages blanches en trop (voir le commentaire sur le fond peint en background réel plutôt qu'en pseudo-élément, ajouté précisément pour cette raison), toujours pas fiable. Corrigé à la racine plutôt que patché encore une fois : les deux boutons appellent maintenant `window.print()` — il n'existe plus qu'UN SEUL moteur de pagination pour tout export (écran, impression, PDF), celui déjà vérifié fiable. `html2pdf.js` retiré du chargement (plus aucun appel dans le code). Doublon de fonctionnalité assumé par Raphaël lui-même dans sa demande : les deux boutons ouvrent désormais le même dialogue d'impression, le second restant utile pour les réglages avancés de l'imprimante. Testé réel (Playwright) : plus aucune référence à `html2pdf`/`genPDF` dans la fenêtre d'export, les deux boutons appellent `window.print()`, structure de pages (`.devis-page`/`.cond`) intacte, 0 erreur.

Ligne de prestation « option à valider par le client » (demande explicite de Raphaël) : nouveau flag `sv.optionClient` (booléen, off par défaut), activable/désactivable par ligne via une case dans le composeur (`.it-opt-toggle`, visible une fois la ligne cochée « on »). Quand actif, le devis imprimé/PDF affiche sous l'intitulé et le prix deux cases vides côte à côte (`.dv-opt-box`, dessinées en CSS — pas un glyphe Unicode, peu fiable selon le moteur PDF) : « ☐ Oui, je valide cette option » / « ☐ Non ». N'affecte que la présentation — le prix et l'inclusion dans le total restent gouvernés par `sv.on` comme n'importe quelle ligne.

**Ne pas casser (option client)** : `sv.optionClient` est lu de façon simplement "truthy" partout — pas besoin de l'initialiser explicitement sur les items existants (créés avant cette fonctionnalité), `undefined` se comporte comme `false`.

**Notes / À faire**
- [x] Aperçu devis plein largeur au lieu du grand vide gris.
- [x] Case « Option à valider par le client » par ligne de prestation, activable/désactivable, affichée en case à cocher Oui/Non sur le devis imprimé/PDF.
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
- [x] Numérotation des duplicatas (`duplicateDevis`) corrigée : `" v2"` était codé en dur, donc dupliquer deux fois le même original (ou dupliquer une copie déjà versionnée) donnait plusieurs "N°0079 v2" au lieu de v2/v3/v4… Le numéro de base est retrouvé en retirant un éventuel suffixe `" vN"` existant, puis la version attribuée est la plus haute déjà utilisée pour ce numéro de base + 1 (parmi tout `devisList`, l'original valant implicitement v1) — quelle que soit la copie d'où l'on duplique. Testé réel : deux duplications du même original → v2 puis v3 ; dupliquer la copie v3 → v4 (pas "v3 v2").
- [x] Repère « OPTION » dans la marge gauche du devis imprimé, à hauteur de chaque ligne ayant `sv.optionClient` actif (demande explicite, capture annotée à l'appui — les deux cases à cocher seules passaient inaperçues). Pur CSS : `.dv-item-option::before{content:"Option";position:absolute;left:-15mm;...}` — `.dv-item-option` était déjà posé sur la div par `buildDevisHTML()` (chantier qu10), aucun changement JS nécessaire. `.devis-page` a `overflow:hidden` : le repère doit rester dans sa boîte. Testé réel (Playwright, mesure `getBoundingClientRect`) : avec le padding écran (18mm), le repère commence à ~3mm du bord de page, se termine avant le début du texte (18mm) — aucun chevauchement, aucun rognage ; au format impression (padding réduit à 16mm), la marge de sécurité tombe à ~1mm mais reste positive.
- [x] « Télécharger le PDF » suit maintenant le même chemin que « Imprimer » (`window.print()`) au lieu de la bibliothèque html2pdf.js/html2canvas, source d'une page blanche en trop dans le PDF (root cause identique à un défaut déjà connu, jamais complètement réglé côté html2canvas). Retiré du chargement de la page — plus aucun appel ne l'utilise.
- [x] Numéro d'un « Nouveau devis » : ne redescend plus jamais, même après suppression du devis qui portait le numéro le plus haut. Demande explicite de Raphaël (confirmé simple à implémenter, préféré à une logique de réattribution des numéros de brouillons supprimés, jugée plus compliquée sans bénéfice clair) : toujours +1 par rapport au dernier devis RÉELLEMENT enregistré, jamais de réutilisation. Nouveau champ `library.branding.maxIssuedNum` (synchronisé au même titre que le reste de `library.branding`), avancé uniquement dans `upsertDevis()` au moment d'un vrai enregistrement (pas à l'ouverture de "Nouveau Devis" — ouvrir/abandonner sans enregistrer ne consomme aucun numéro, cohérent avec la protection anti-fantômes déjà en place). `newDevis()` prend le plus grand entre ce plancher, `numStart` (réglage) et le max actuel de `devisList` (garde-fou pour d'anciennes données sans le nouveau champ). Testé réel : après un devis 0079, "Nouveau devis" propose 0080 ; l'ouvrir/l'abandonner plusieurs fois de suite reste à 0080 (aucun gaspillage) ; une fois ce 0080 réellement enregistré PUIS supprimé, le "Nouveau devis" suivant propose 0081, jamais une deuxième fois 0080.
- [x] Bouton flottant « 👁 Aperçu » désormais visible ET fonctionnel aussi en « Vue bureau » forcée sur un écran de téléphone (`≤900px`) — jusqu'ici masqué dans ce mode (raisonnement d'origine : les deux volets sont déjà côte à côte, donc pas besoin de bouton), mais sur un vrai écran de téléphone ce mode serre l'éditeur et l'aperçu en deux colonnes étroites et peu lisibles. Demande explicite de Raphaël, confirmée avec lui (« comme on a sur la vue bureau », le bouton flottant mobile déjà existant). Deux nouvelles règles CSS (`body.force-split.devis-active.show-preview .editor{display:none}` / `…show-editor .preview-wrap{display:none}`, scopées à `≤900px`, plus spécifiques que les règles "toujours les deux côte à côte" de Vue bureau) rétablissent un vrai basculement plein écran dans ce cas précis, sans toucher au vrai bureau (`>900px`, bouton resté masqué, les deux volets suffisent déjà) ni à Vue bureau sur un écran large. Testé réel (Playwright, 390px) : bouton visible et basculement fonctionnel une fois Vue bureau activée ; vrai bureau (1280px) inchangé, bouton toujours masqué.
- [x] Le même bouton disparaissait en tournant le téléphone en mode paysage : un téléphone récent tourné peut dépasser les 900px de largeur (la coupure "mobile" habituelle) tout en restant un petit écran, pas une tablette. Nouvelle requête média séparée, scopée strictement à `min-width:901px et max-height:500px` (repère la hauteur, toujours faible sur un téléphone même en paysage, plutôt que la largeur) pour ne toucher à aucune autre règle de mise en page — demande explicite de Raphaël de ne surtout rien casser d'autre. Testé réel : 915×412 (paysage large) → bouton visible ; 1280×900 (vrai bureau) → toujours masqué, aucune régression.
- [x] Le seuil de hauteur (500px) ci-dessus s'est avéré insuffisant sur le vrai téléphone de Raphaël (capture à l'appui) — les hauteurs réelles en paysage varient trop selon appareil/navigateur pour deviner un seuil fiable en devinant. Remplacé par une détection plus robuste : un écran tactile sans souris (`hover:none` + `pointer:coarse`, vrai sur tout téléphone/tablette, jamais sur un bureau à souris) combiné à une largeur encore raisonnable (`max-width:1024px`, au-delà c'est une vraie tablette) plutôt qu'un seuil de pixels de hauteur deviné. Testé réel (Playwright, `hasTouch`) : téléphone large en paysage (950×550, tactile) → bouton visible ; MÊME taille de fenêtre SANS tactile (bureau redimensionné petit) → bouton reste masqué, aucune régression ; tablette large en paysage (1194×834, tactile) → correctement exclue ; portrait normal et vrai bureau → inchangés.
- [x] **Régression réelle introduite par le correctif ci-dessus, trouvée par Raphaël sur sa tablette** (capture à l'appui : Vue bureau activée, aperçu de base à droite complètement absent — « à ne pas confondre avec le bouton flottant, qui lui fonctionne très bien »). La règle `(hover:none) and (pointer:coarse) and (max-width:1024px)` visait les téléphones en paysage mais attrapait aussi les tablettes dans cette même fourchette de largeur (900-1024px) — un vrai chevauchement, pas un cas limite théorique. Root cause du bug affiché : le corps de page démarre avec la classe `show-editor` (état par défaut, avant tout clic sur le bouton flottant), et la règle de bascule plein écran cachait `.preview-wrap` dans cet état — sur téléphone c'est voulu (Vue bureau y bascule un seul volet), sur tablette c'était la régression (les deux volets doivent rester visibles par défaut). Corrigé en séparant les deux effets qui n'auraient jamais dû partager la même condition : la visibilité du bouton flottant reste basée sur la largeur/le tactile (inchangée, harmless même sur tablette) ; le VRAI basculement plein écran passe à un critère fiable dans les deux orientations — `(max-width:500px),(max-height:500px)` — puisqu'un téléphone, portrait ou paysage, a toujours son petit côté sous 500px, alors qu'une tablette, même la plus petite, dépasse 650px sur son petit côté quelle que soit l'orientation. Testé réel (Playwright) : tablette paysage (1024×768) et portrait (768×1024) → éditeur ET aperçu visibles ensemble (régression corrigée) ; téléphone paysage (950×412) et portrait (390×844) → bascule un seul volet à la fois (comportement voulu, préservé) ; vrai bureau (1280×900) → inchangé.
- [x] Interrupteur Mobile/Bureau à deux positions, remplaçant l'ancien bouton unique au texte changeant ("🖥 Vue bureau" / "📱 Vue mobile" selon l'état) — jugé confus par Raphaël, fallait lire le texte pour savoir où on était. Nouveau composant réutilisable `.view-switch` (deux boutons toujours visibles, celui actif surligné) partagé entre la barre du haut (821-900px) et le menu "⋯ Plus" (≤820px) via `syncViewSwitches()`, qui tient toutes les instances à jour ensemble. Aucun changement de comportement sous-jacent (`applySplitView`/`toggleSplitView` inchangés dans leur logique), seulement la façon de le montrer. Testé réel : état initial correct, bascule dans les deux sens (barre du haut et menu Plus), aucune régression sur le vrai bureau (interrupteur reste masqué, `>900px`).
- [x] Section Client du composeur compactée sur mobile, même demande/même technique que la fiche client (juste au-dessus) : les 8 champs (Raison sociale, Contact, Téléphone, Email, Adresse, N° société, Ville, Code postal) passaient d'un empilement pleine largeur (2 colonnes déjà présentes en bureau, réempilées l'une sous l'autre sous 600px) à un vrai champ par ligne. Chaque colonne d'origine passe désormais de `display:block` à `flex-wrap` deux champs par rangée, strictement sous 600px (seuil déjà en place pour cette section, bureau intact) — aucun champ déplacé d'une colonne à l'autre (contrairement à la fiche client, ici l'ordre/regroupement existant suffisait déjà) : Raison sociale/Contact, Téléphone/Email, Adresse/N° société, Ville/Code postal. Testé réel (Playwright) : regroupement en 4 rangées confirmé, tous les `id` de champs intacts (`fillFields()`/saisie inchangés), bureau (1280px) toujours en une colonne par bloc, `.two-col` n'étant utilisée qu'à cet unique endroit du fichier — aucun risque de collision avec une autre section.

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
- [x] Filtre par client dans le menu "🔍 Filtrer" : 5e colonne "👤 Client" avec champ de recherche (filtrage DOM local sans re-rendu, pour ne pas perdre le texte tapé à chaque frappe) au-dessus d'une liste cliquable de tous les clients triés par nom — sélection unique (comme "Tous les clients" pour réinitialiser). Un client sélectionné filtre la liste de tâches ET affiche une bannière résumé (`#task-client-summary`) au-dessus : total de tâches de ce client, terminées, en cours, en retard, + lien "Voir la fiche →". Le résumé porte sur TOUTES les tâches du client (indépendant des autres filtres actifs), pour répondre à "ai-je bien attribué mes tâches à ce client". `taskFilterClientId` persisté dans `localStorage['mn_task_filters']` aux côtés des autres filtres ; `clearTaskFilters()` le réinitialise aussi. Testé réel (Playwright) contre le code actuel de `main`.

**Trouvé lors d'un audit demandé par Raphaël** (« fais un tour sur le code pour vérifier ce genre d'erreur plutôt qu'on s'en rende compte au fur et à mesure ») en cherchant d'autres instances du trou déjà comblé pour devis/bibliothèque/réalisations/boutique/chantier : `handleRealtime` traitait bien `kind==='tasks'` (mettait à jour le tableau `tasks` en coulisse) mais ne repeignait JAMAIS le tableau de bord affiché, et n'avait AUCUNE protection contre l'écrasement d'une saisie en cours (contrairement aux quatre autres types de données, déjà protégés) — seul type de donnée synchronisée oublié de ce filet de sécurité. Corrigé à l'identique du patron existant : nouvelle garde `isEditingTasks()` (scope `#dashboard-view`), `renderTaskList()` appelé après un écho distant (et après le chargement initial dans `loadAll()`) sauf saisie active en cours.

**Ne pas casser** : toute nouvelle collection synchronisée doit être ajoutée aux DEUX filets de `handleRealtime` — la garde anti-écrasement (`isEditingX()`) ET le repeint final de l'écran visible — pas seulement à `SYNC_KEYS`/`cloudPush`/`loadAll`. C'est précisément l'oubli qui a laissé ce trou sur les tâches pendant tout ce temps sans être remarqué.

**Notes / À faire (suite)**
- [x] Le tableau de bord des tâches se rafraîchit en direct sur un écho distant, avec protection de la frappe active (trou identique à celui des devis/bibliothèque, jamais comblé jusqu'ici).

**Menu « 🔍 Filtrer » débordait de l'écran sur mobile** (Raphaël, capture à l'appui) : le menu, presque pleine largeur (`width:min(94vw,620px)`), hérite de `.vnav-menu{position:absolute;left:0}` — pensé pour un menu étroit ancré près du bord de l'écran (comme le menu "Devis" dans la barre du haut). Le bouton "Filtrer" est au milieu d'une rangée de trois ("+ Nouvelle tâche" / "Filtrer" / "Ordre"), pas au bord : le menu débordait largement à droite. Un simple centrage CSS sur le bouton, essayé en premier, ne suffisait pas de façon fiable (revérifié : déborde encore, juste du côté opposé, selon la position exacte du bouton) — seule une position calculée par rapport à l'ÉCRAN, pas au bouton, garantit qu'un menu presque pleine largeur reste toujours dans l'écran. Corrigé : `toggleTaskFilterMenu()` calcule, à l'ouverture et uniquement sous 680px, la position réelle du bouton (`getBoundingClientRect()`) puis bascule le menu en `position:fixed` avec des marges fixes de 12px de chaque côté de l'écran (classe `.mobile-fixed`) — seul le `top` varie selon où se trouve le bouton. Au-delà de 680px, comportement inchangé (`position:absolute` ancré au bouton, la classe `.mobile-fixed` n'est jamais posée). Le menu "Devis" (`.vnav-menu` seul, sans `.task-filter-menu`) n'est pas concerné par ce changement. Testé réel (Playwright, 390px) : menu correctement contenu entre 12px et 378px (aucun débordement, ni à droite ni à gauche) ; fermeture au clic extérieur puis réouverture toujours correctes ; cases à cocher toujours cliquables ; bureau (1280px) : `position:absolute`, classe `.mobile-fixed` jamais posée, comportement identique à avant.

**Suite, signalé par Raphaël avec captures (« c'est coupé, ça flotte pas ») : le correctif ci-dessus réglait la largeur mais pas la hauteur.** Rien ne limitait la hauteur du menu — sur un vrai téléphone, il continuait sous la barre de navigation du bas, coupant net les colonnes Priorité/Client et le bouton Réinitialiser, devenus inatteignables. Corrigé : `toggleTaskFilterMenu()` calcule `max-height` à l'ouverture = hauteur disponible entre le bas du bouton et le haut de la barre du bas — dont la hauteur RÉELLE est mesurée sur l'appareil (`getBoundingClientRect()`), pas devinée (une barre de navigation n'a pas la même hauteur partout, notamment avec l'encoche de sécurité) — plus un défilement interne (`overflow-y:auto`) si le contenu dépasse quand même. Au passage, demande explicite pour gagner de la place : Échéance et Rappel (une seule case à cocher chacun) regroupés dans UNE colonne au lieu de deux pleine largeur, titres conservés, l'un au-dessus de l'autre — 4 colonnes au lieu de 5. Testé réel (Playwright, 390px, avec 15 clients pour reproduire une longue liste) : le bas du menu reste toujours au-dessus du haut de la barre de navigation ; le bouton Réinitialiser, hors de vue au premier coup d'œil, est atteignable en faisant défiler DANS le menu ; bureau (1280px) inchangé (pas de `max-height` forcée, pas de `.mobile-fixed`).

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

**Compactage des coordonnées sur mobile** (demande explicite de Raphaël, capture annotée à l'appui — les champs Contact/Téléphone/Email/Ville empilés un par ligne rendaient la carte trop haute) : sous 760px uniquement (le même seuil déjà utilisé pour l'empilement de `.cl-two-col`, bureau/tablette inchangés), `.cl-side-body`/`.cl-side-more` passent de `flex-direction:column` à `flex-wrap:wrap` avec chaque champ à `flex:1 1 calc(50% - 6px)` — deux champs par rangée au lieu d'un, sans changer un seul pixel au-delà de 760px. Champs réordonnés pour que le regroupement en paires tombe exactement comme demandé (4 blocs) : Contact+Téléphone, puis Adresse/Ville (renommé depuis « Ville », même champ `data-cf="ville"`, aucune donnée touchée) + Email (déplacé de `.cl-side-body` vers `.cl-side-more`, juste après Ville), Début+Fin, Commentaire seul (5 champs dans ce groupe, le dernier retombe naturellement à la ligne suivante avec `flex-wrap`, pas de règle spéciale nécessaire). Au passage : le nom du client remplit automatiquement le champ Contact quand celui-ci est encore vide (souvent la même personne) — ne touche jamais un contact déjà renseigné, même garde que le chemin inverse déjà existant (taper un contact sur un client sans nom lui donne son nom). Testé réel (Playwright) : ordre des champs et regroupement par rangée exacts (4 blocs), auto-remplissage du contact vide confirmé, contact déjà rempli jamais écrasé même après un changement de nom, champ `data-cf="ville"` toujours présent (donnée intacte), bureau (1280px) toujours en colonne — zéro régression.

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

## Choisir ce qui part sur le site (septembre 2026)

**État** : livré, testé, déployé. Chantier `cr06`.

**Le reproche** : « quelle photo je sélectionne en version finale, et ensuite lesquelles je
choisis pour les pousser sur le site, ce n'est toujours pas assez clair ». Deux manques
distincts : le choix de la version se faisait au fond d'un onglet de l'éditeur, et le choix
des photos n'existait pas — publier envoyait forcément toute la réalisation.

**Les deux règles, écrites une seule fois**

- `photosPubliees(r)` — les photos qui partent : celles qui ne portent pas `p.horsSite`.
- `couvertureEffective(r)` — la couverture choisie, sauf si elle est écartée, auquel cas la
  première photo publiée.

Le plan (`realisationPublishPlan`), la publication, les décomptes et l'écran de confirmation
s'en servent tous. **C'est le point à ne pas casser** : une deuxième définition de la
couverture avait pour effet qu'une photo restait « à republier » pour toujours — publiée
comme couverture d'un côté, comparée à un autre choix de l'autre. Trouvé par le test, pas à
l'œil.

**Interface**

- Menu ⋯ d'une vignette : « 🖼 Version publiée : … » ouvre la liste des versions (l'active
  cochée) ; « 🚫 Ne pas publier cette photo » l'écarte, avec une confirmation qui dit ce
  qu'elle devient.
- Vignette écartée : pastille « écartée du site » et mise en retrait (`.rz-hors-site`).
- Écran de publication : « X photo(s) sur Y partiront », les écartées comptées à part, le
  nom de la version retenue sous chaque « va partir », et l'avertissement si la couverture
  est écartée.
- Refus explicite quand tout est écarté, dans `askPublishRealisation` **et** dans
  `publishRealisation` (« Tout republier » appelle la seconde directement).

**Vérification** : 462 contrôles au navigateur (17 ajoutés ici), 20 de bout en bout, 99 sur
le site, 20 sur le pont. Parcours réel en 390 px.

## Solde fal.ai : ce qui a été vérifié (septembre 2026)

**État** : diagnostiqué et expliqué à l'écran ; l'affichage lui-même dépend d'une clé que
seul le titulaire du compte fal.ai peut créer. Chantier `ph12`.

**Preuves, pas déductions** : les journaux de la fonction `photo-ia` en production renvoient
à chaque appel `balance: HTTP 403 authorization_error — This API key is not permitted to
perform this action.` Et la documentation de fal (authentification + API de compte) ne
documente **aucun** point d'entrée donnant le solde avec une clé de portée API ;
`GET /v1/account/billing` demande une clé ADMIN.

**Ce qui a été changé** : faire disparaître la pastille quand aucune clé ADMIN n'est
configurée était défendable — pas d'alerte permanente pour une fonction volontairement
désactivée — mais laissait sans réponse la question « où sont mes crédits ? ». La pastille
reste, affiche « non lu », ne prétend rien, et un appui ouvre `iaExpliquerSolde()` : trois
étapes numérotées, lien direct vers `fal.ai → Keys`, lien direct vers les secrets du projet
Supabase (construit depuis `SB_URL`, pas codé en dur), et le nom exact du secret
`FAL_ADMIN_KEY`. `FAL_KEY` n'est pas touchée : la retouche continue pendant et après.

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

**Vérification** : 401 contrôles (7 ajoutés ici), dont le cas exact signalé rejoué à 390 px —
une photo sans retouche portant `rot:12`, la ligne d'état, la visibilité de l'indice, la
liste masquée, et la remise à zéro.

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
- Le silence quand `adminManquante` est vrai ne doit JAMAIS s'étendre aux autres échecs :
  une clé ADMIN refusée ou expirée est une vraie panne et doit rester signalée. Deux tests
  gardent la frontière.
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
- [x] ~~Créer une clé fal.ai de portée ADMIN pour afficher le solde~~ — **écarté par
      Raphaël** le 05/09 : « je m'en fous, conserve la même clé ». C'est une décision, pas
      un oubli : **ne pas la lui représenter**. Le code reste prêt (`FAL_ADMIN_KEY`, lue
      séparément de `FAL_KEY`) si l'envie revient : créer la clé sur fal.ai → Keys en
      portée ADMIN, la déposer dans Supabase → Edge Functions → Secrets sous ce nom, ne
      pas toucher à `FAL_KEY`, rien à redéployer.
- [x] Conséquence traitée : sans clé ADMIN, le panneau n'affiche **ni pastille de solde ni
      alerte**. Afficher « n/c » en permanence pour une fonction volontairement désactivée
      apprend à ignorer les alertes. Une clé ADMIN présente mais refusée reste, elle,
      signalée — les deux cas sont distingués par un drapeau renvoyé par le pont
      (`adminManquante`), pas par l'analyse d'une phrase française. Fonction `photo-ia`
      déployée en version 8.
- [ ] Suivi d'avancement pendant la génération : la file d'attente vient d'être livrée par
      une autre session (état sur le bouton, annulation possible, reprise à la réouverture).
      Raphaël demandait « vérifier qu'il y a bien les chargements de l'action » — à
      reregarder avec lui sur l'écran réel avant d'y toucher, pour ne pas refaire ce qui
      existe déjà.

## Site vitrine — l'allure devient un réglage (septembre 2026)

**État** : livré et déployé. Le site avait toutes ses fonctions et aucune identité.

**Ce que Raphaël a choisi**, sur la fiche
https://claude.ai/code/artifact/0a5981ec-e66c-4ec9-86dd-500d76843969
(réponses en base, collection `reponses`, document `site-theme` — **les relire avant de
reprendre ce chantier**) : direction **Index**, la grille des projets d'emblée en arrivant,
mouvement **discret**, sections *réalisations · studio · contact · journal*, et les trois
langues *français, anglais, hébreu*.

Ses mots, qui commandent la suite : « il y a une section par thème et c'est plutôt
cohérent, ça serait bien qu'il y ait les sections : commercial, habitation, bureaux,
réalisation sur mesure » et « le site doit être facilement modulable ».

**Ce qui a été relevé, en vrai, sur cinq références** (menus téléchargés, pas de mémoire) :
David Chipperfield, Studio KO, Norm Architects, Vincent Van Duysen, Pierre Yovanovitch.
**Aucun n'a de blog, de tarifs, de témoignages ni de formulaire long.** Ils tiennent tous
en trois sections : les projets classés par type, un « studio / à propos », un contact.
Ne pas proposer autre chose sans une raison.

**Comment l'allure circule** : réglage dans le CRM (⚙ Le site public → *Allure du site*) →
publié dans `manifest.site.theme` par « Mettre à jour le site » → le site pose
`data-theme` sur `<html>` et tout suit par variables CSS. Aucune clé d'accès ajoutée à la
page publique. Quatre directions : `index`, `epure`, `atelier`, `nuit`.

**Ne pas casser**
- `atelier` est le défaut, et c'est **exactement** l'habillage d'avant : un manifeste publié
  avant cette version ne doit pas changer d'allure tout seul.
- Un thème absent du catalogue **ne part pas** dans le manifeste, et un `data-theme` inconnu
  laisse la page sur son défaut. Sinon le choix n'a pas d'effet et rien ne dit pourquoi.
- **Aucune couleur ni police écrite en dur** dans `site-vitrine/index.html` : tout passe par
  les jetons (`--ink`, `--paper`, `--titre`, `--texte`, `--nom-*`). Une valeur en dur
  fabrique un thème qui ne s'applique qu'à moitié — le cas « fond sombre, texte sombre ».
- **Le piège du mouvement** : la classe `fondu` (opacity:0) n'est posée QUE si un
  `IntersectionObserver` existe pour la retirer, que le réglage l'autorise, et que le
  visiteur ne demande pas moins d'animation. Une image parquée invisible sans surveillant,
  c'est une page blanche pour qui partage le lien. Deux tests gardent ce piège fermé, dont
  un qui supprime `IntersectionObserver` du navigateur.
- Le choix d'une direction dans le CRM **n'est pas en ligne** tant que « Mettre à jour le
  site » n'a pas été cliqué. Le panneau le dit à chaque clic ; ne pas retirer ce rappel.

**Vérification** : `tests/site.test.mjs` (8 nouveaux contrôles — les quatre thèmes, le thème
inconnu, la mise en page Index mesurée sur les positions réelles, et les deux pièges du
mouvement) et `tests/realisations.test.mjs` (4 nouveaux — le défaut, le choix publié, le
thème inventé qui ne part pas, le catalogue).

**Notes / À faire**
- [x] Le thème devient un réglage du CRM, publié dans le manifeste.
- [x] Direction « Index » livrée en entier, sur téléphone comme sur ordinateur.
- [x] Mouvement discret, sans jamais rien laisser d'invisible.
- [ ] **Les catégories comme structure du site** (`commercial, habitation, bureaux,
      sur-mesure`). Aujourd'hui la catégorie d'une réalisation est un champ libre avec
      suggestions : deux fautes de frappe font deux catégories. Il faut une **liste
      ordonnée, modulable depuis le CRM** — reprendre le patron déjà en place
      (`chantierCats`, `taskCategories`, `clientStatuses`), ne pas en inventer un autre —
      et le site doit respecter **cet ordre**, pas l'ordre alphabétique.
- [ ] **Page « Le studio »** — bloquée sur du contenu réel. Ne rien inventer à la place de
      Mélissa : ni parcours, ni démarche, ni références. Construire la page vide et prête à
      recevoir, et lui demander un texte et un portrait.
- [ ] **Journal / actualités** — demandé par Raphaël, alors qu'aucune des cinq références
      n'en a (sauf le « KO diary » de Studio KO). Un journal vide ou abandonné fait plus de
      mal que pas de journal : à ouvrir seulement quand il y a de quoi l'alimenter, et lui
      poser la question avant de le construire.
- [ ] **Anglais et hébreu** — l'hébreu retourne toute la mise en page (droite à gauche),
      c'est le plus lourd des trois chantiers de langue. Et surtout : chaque projet devra
      être **écrit trois fois** (titre, lieu, mission, texte de présentation). C'est du
      contenu que Mélissa doit produire, pas du code. À chiffrer avec eux avant de lancer.

## Publication — dater les photos APRÈS le manifeste (septembre 2026)

**Défaut corrigé** : `publishRealisation` posait `p.publishedAt` dans la boucle d'envoi des
photos, avant `writeManifest`. Une écriture de manifeste qui échoue laissait donc les photos
marquées « en ligne » côté CRM alors que le site n'avait rien reçu : la pastille passait à
« ● en ligne », le rappel « à republier » disparaissait, et l'écart entre le CRM et le site
devenait invisible.

Les photos envoyées sont maintenant collectées dans `posees` et datées **après** l'écriture
du manifeste, en même temps que `r.publishedAt`. Ne jamais remonter cette datation dans la
boucle : tant que le manifeste n'est pas écrit, rien n'est en ligne.

Trouvé en écrivant le test d'échec de « Tout republier » — la publication en lot rend ce
scénario beaucoup plus probable (plusieurs écritures de manifeste d'affilée).

## Écritures multiples sans transaction (septembre 2026)

Trois corrections de la même famille, trouvées en écrivant des tests d'échec :

1. **Publication** : `p.publishedAt` était posé avant l'écriture du manifeste (voir plus
   haut). Corrigé.
2. **`replaceOnePhoto`** : deux fichiers écrasés sans retour possible. Les anciens sont
   maintenant relus AVANT l'échange et remis en place si un envoi échoue.
3. **`importOnePhoto`** : le premier fichier envoyé restait orphelin dans le seau si le
   second échouait. Il est effacé.

**Règle** : rien ne se marque « fait » tant que la dernière écriture n'a pas réussi, et tout
ce qui a été écrit avant l'échec se nettoie. Les trois cas ont chacun leur test d'échec —
c'est le seul moyen de les voir, aucun ne se manifeste en usage normal.

## Audit général du dépôt CRM (15 septembre 2026)

Demandé sans point précis : propreté du dépôt, absence de régression/risque futur,
compatibilité multi-navigateurs/appareils/orientations, complétude de la synchro. Détail
narratif dans `docs/journal.md` (suite 20) ; ici, le résumé technique.

**Branches** : `main` propre et à jour. 26 branches locales `claude/*` déjà fusionnées,
supprimées. 8 branches distantes orphelines + 1 redondante (`claude/solde-sans-cle-admin`)
repérées mais **non supprimées côté distant** : `git push origin --delete` renvoie une
HTTP 403 dans cet environnement (restriction de permission confirmée, pas un bug), et
aucun outil GitHub disponible ici n'a d'équivalent à la suppression de branche. À faire
depuis l'interface GitHub, ou à débloquer côté permissions de l'environnement.

**Code mort retiré** (vérifié par comptage d'occurrences dans tout le fichier + absence
d'invocation dynamique `eval`/`window[...]`) : `askInfo()`, `printDevis()`,
`toggleSplitView()`, et un `console.log` de debug dans `reparerNomsClients()`.

**Faille de synchro comblée** : `library` (Réglages/branding + bibliothèque de
prestations) était le seul type de donnée synchronisée sans garde-fou contre un écho
temps réel écrasant une saisie en cours — les six autres (`client`, `devis`, `tasks`,
`realisations`, `produits`, `chantier`) en ont chacun un. Ajouté `isEditingLibrary()`,
posé/effacé via `#modal.dataset.editing` dans `openSettingsPanel()`/`openLibraryPanel()`/
`closeModal()`, et le branchement correspondant dans `handleRealtime()`.

**Compatibilité navigateurs/appareils**, quatre correctifs :
- `body.force-split.devis-active` : `height:100dvh` ajouté en complément de `100vh`
  (barre d'outils dynamique de Safari iOS).
- `.rz-tag` : préfixe `-webkit-backdrop-filter` manquant, ajouté (comme ailleurs dans le
  fichier).
- `.toast` et `#devis-tab-fab` : `bottom` fixe remplacé par
  `calc(20px + env(safe-area-inset-bottom,0px))` (encoche/barre de gestes iPhone).

Déjà corrects, vérifiés sans modification : tous les accès `localStorage` protégés par
try/catch ; aucun `:has()` ni API récente non protégée.

**Limite de l'audit** : seul Chromium est disponible ici pour Playwright (pas de WebKit
ni Firefox, installation interdite) — Safari a été couvert par revue de code + émulation
Chromium avec UA/appareil Safari, pas par un vrai moteur WebKit.

**Test corrigé, sans lien avec le reste** : `tests/realisations.test.mjs` échouait sur le
solde fal.ai simulé (« n/c » au lieu du montant attendu). Cause : l'éditeur photo,
ouvert une première fois plus tôt dans le test pour vérifier le redressement de façade,
tente un vrai appel réseau de solde avant que le mock du pont `photo-ia` ne soit posé —
l'échec réseau reste en cache 60s et masque le mock, posé correctement juste après.
Corrigé en vidant `_iaBalance` après la pose du mock.

**Vérification** : `tests/realisations.test.mjs` 590/590 (588/2 échecs au départ). Passe
Playwright dédiée sur 8 profils (iPhone/Pixel/iPad portrait+paysage, bureau Chrome, UA
Safari/Mac) parcourant tout l'applicatif : 0 erreur.

**Notes / À faire**
- [ ] Supprimer les 9 branches distantes orphelines/redondantes identifiées — bloqué ici
      par une permission (HTTP 403 sur la suppression de ref distante), à faire depuis
      GitHub ou en élargissant l'accès de l'environnement.
- [ ] Un vrai test sur iPhone/Mac physique reste la seule vérification Safari définitive,
      cet environnement ne pouvant pas lancer WebKit.

**Addendum (même jour, contrôle redemandé)** : branches distantes revérifiées par le
contenu, pas seulement `git branch --merged` — 50 fusionnées (pur encombrement), 8 sans
aucun ancêtre commun avec `main` (racine d'avant la reprise à zéro de l'historique du 5
septembre, tout leur contenu déjà réimplémenté et dépassé dans `main` actuel, vérifié
marqueur par marqueur), 1 (`claude/solde-sans-cle-admin`) doublon confirmé une seconde
fois. Suppression toujours bloquée (HTTP 403, reconfirmé). Les trois suites de tests non
lancées lors de l'audit précédent (`site.test.mjs`, `bout-en-bout.test.mjs`,
`pont-ia.test.mjs`) ont tourné cette fois : `site.test.mjs` échouait sur
`ERR_CERT_AUTHORITY_INVALID` (polices Google via le proxy de cet environnement, dont le
certificat n'est pas approuvé par le Chromium de test) — le filtre `envNoise` du test ne
couvrait que les échecs DNS/connexion, pas les échecs de certificat ; ajouté `ERR_CERT`
au filtre. Sans lien avec le code du site. Total après correctif : 826 vérifications sur
les quatre suites, 0 échec.
