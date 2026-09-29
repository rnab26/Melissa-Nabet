# CLAUDE.md

Consignes de travail pour Claude sur ce dépôt. À lire avant toute intervention.

## Exécution autonome

- "Demande explicite" veut dire : la tâche (ou la liste de tâches) a été confirmée une fois dans la discussion. À partir de là, exécuter TOUT de bout en bout soi-même — commit, push, merge sur `main`, déploiement si c'est le but — sans redemander à chaque étape, et sans jamais demander à l'utilisateur de cliquer lui-même quelque part (GitHub, dashboard, etc.).
- Si un outil technique bloque une action normalement autorisée, chercher un autre chemin qui aboutit au même résultat plutôt que de renvoyer la balle à l'utilisateur.
- Rendre compte après coup, pas avant — sauf vraie décision ambiguë que l'utilisateur doit trancher lui-même (celle-là, on la pose avant d'agir).
- Si quelque chose casse après une action faite en autonomie, revenir en arrière dès que l'utilisateur le signale, sans validation préalable requise pour le rollback.

## Discipline de branche

- Chaque chantier de code a sa propre branche ; ne jamais déborder sur la branche d'un autre chantier en cours.
- Merger/déployer du code reste conditionné à une tâche confirmée (voir Exécution autonome ci-dessus) — mais une fois confirmée, l'exécution complète, merge sur `main` inclus, est toujours faite directement, sans étape de validation supplémentaire.
- **Fichiers de doc/suivi (`CLAUDE.md`, `PROJECT_LOG.md`)** : mise à jour de routine, pas une vraie décision — se créent, se modifient et se poussent directement sur `main`, sans demander confirmation à chaque fois. Si `git push` vers `main` est bloqué par une contrainte de session, utiliser l'API GitHub (`create_or_update_file`) à la place.

## Rigueur technique

- Ne jamais deviner le comportement d'une API externe. Vérifier la vraie documentation ou le vrai code source avant d'écrire quoi que ce soit qui en dépend.
- Ne jamais simuler ou supposer un résultat. Un correctif n'est considéré validé qu'après un test réel qui passe (pas une relecture du code, pas une déduction logique — un test exécuté).
- Utiliser les temps d'attente (build, déploiement, réponse externe) pour chercher d'autres améliorations pertinentes plutôt que d'attendre passivement sans rien faire.
- Honnêteté sur la qualité : si une approche plafonne, le dire clairement plutôt que d'enjoliver ou de minimiser. Pas de faux optimisme sur l'état d'avancement.

## Sécurité et ressources

- Signaler immédiatement tout identifiant, clé ou secret qui transite en clair (code, logs, message) pour rotation — ne pas attendre qu'on le demande.
- Rappeler de réduire/couper les ressources externes coûteuses (GPU, instances, etc.) une fois une configuration validée et qu'elles ne sont plus nécessaires.

## Communication

Toujours rendre compte en français, de façon concise et directe. Pas de remplissage, pas de tournures commerciales.

## Requêtes SQL : `scripts/sql.sh`, jamais l'outil MCP, jamais demandé à Raphaël

**N'utilise pas `mcp__Supabase__execute_sql`, et ne demande jamais à Raphaël d'exécuter
du SQL à ta place.** Le premier impose un pop-up de validation humaine à chaque appel,
impossible à supprimer ; le second est exactement ce qu'il a demandé de retirer le
6 sept. 2026 — les sessions autonomes de ce dépôt le sollicitaient encore « de temps à
autre » pour du SQL.

```bash
scripts/sql.sh "select id, titre, statut from chantiers where statut <> 'livre';"
```

Passe par la fonction `public.exec_sql` (migration `20260906_exec_sql_pour_sessions.sql`)
via l'API HTTPS, avec la clé `SUPABASE_SERVICE_ROLE_KEY_MELISSA` fournie par
l'environnement cloud (nom distinct de celle du projet Jarvis-assistant, qui partage le
même environnement — un nom identique écraserait l'autre clé). Repris à l'identique du
dépôt Jarvis-assistant, où ce chemin existe depuis le 3 sept. 2026.

Une seule instruction par appel quand tu attends un résultat (l'enveloppe qui récupère
les lignes en JSON ne supporte qu'un seul `select`) ; grouper est bon pour des écritures
liées dont on n'attend pas de lignes, avec la vérification dans un appel séparé. Sans
`begin; … commit;` : `exec_sql` refuse les commandes de transaction. Cette clé donne un
accès total à la base (DDL et suppressions comprises) : la règle ne change pas, on
demande à Raphaël avant tout `drop`, `delete` massif ou `truncate`.

Si `SUPABASE_SERVICE_ROLE_KEY_MELISSA` est absente de ton environnement, le script le dit
et s'arrête : c'est que Raphaël n'a pas encore déposé cette clé dans les variables
d'environnement de l'environnement cloud Claude Code (jamais dans le dépôt, jamais collée
dans la conversation) — signale-le-lui plutôt que de repasser par l'outil MCP.

## Déployer une fonction serveur

`scripts/deploy-fonction.sh photo-ia` — appelle l'API de gestion Supabase en HTTPS, avec
`SUPABASE_ACCESS_TOKEN` pris dans l'environnement (jamais dans le dépôt). C'est le chemin à
utiliser : les outils MCP marqués « exige une interaction humaine » rouvrent un pop-up à
chaque appel, et aucun réglage ne le supprime.

`verify_jwt` reste **false** pour `photo-ia` et `embellish`, volontairement : la clé
publicable de l'application est elle-même un JWT valide, la vérification générique de Supabase
laisserait donc passer n'importe qui. Le vrai contrôle est `requireUser` dans la fonction.

## Adresses du projet

- **CRM** (privé, connexion obligatoire) : https://rnab26.github.io/Melissa-Nabet/ — dépôt `rnab26/Melissa-Nabet`.
- **Site vitrine** (public) : https://rnab26.github.io/melissa-nabet-site/ — dépôt **séparé** `rnab26/melissa-nabet-site`.
  Alimenté depuis le CRM (onglet Réalisations → « Publier sur le site »). La page publique ne contient **aucune clé d'accès** : ne jamais en ajouter, elle n'en a pas besoin.

## Tableau de bord des chantiers

**https://claude.ai/code/artifact/c7ead2fa-509a-4bf4-a2c5-ac18a5063d84**

Tous les chantiers du CRM et du site, par section, avec statut, priorité, effort et branche.
C'est la **source de vérité de ce qui reste à faire** — le lire avant de proposer quoi que ce
soit, et y passer un chantier à « livré » quand il l'est. Les données vivent dans la base de
l'artefact (`read_db` / `write_db`, collection `chantiers`, un document par chantier).

Chaque chantier a un bouton « Prompt » qui produit de quoi démarrer une session dédiée.
Une session qui prend un chantier le passe d'abord en « en cours », pour qu'une autre ne le
reprenne pas en parallèle.

## Fiches de décision (artefacts)

Questions ouvertes posées à l'utilisateur sous forme d'artefact cliquable plutôt qu'en mur de texte. Les réponses sont stockées dans la base de l'artefact (`read_db` / `write_db` sur son URL) — **les relire avant de reprendre le chantier concerné**, elles ne sont pas dans la conversation.

- **Photos de chantier (qualité pro pour le site)** — https://claude.ai/code/artifact/46d7e74d-3f5e-45a6-b922-3cc10d562254
  Réponses : collection `reponses`, document `photos-chantier` (`choices` + `notes`).

- **Identité du site vitrine (quatre directions visuelles)** — https://claude.ai/code/artifact/0a5981ec-e66c-4ec9-86dd-500d76843969
  Réponses : collection `reponses`, document `site-theme` (`theme`, `sections`, `accueil`,
  `mouvement`, `langues`, `notes`). **À relire avant de toucher au chantier « Site vitrine ·
  Identité »** : le thème retenu, les sections voulues et le degré de mouvement y sont, et
  ils ne sont écrits nulle part ailleurs.
  La fiche s'appuie sur un relevé réel des menus de cinq références (David Chipperfield,
  Studio KO, Norm Architects, Vincent Van Duysen, Pierre Yovanovitch) : elles tiennent
  toutes en trois sections — projets classés, studio, contact. Aucune n'a de blog, de
  tarifs ni de témoignages. Ne pas en proposer.


## Cockpit (rnab26/Cockpit-General)

Ce projet est suivi dans le cockpit central (projet `melissa-nabet`, app
https://rnab26.github.io/Cockpit-General/, base Supabase centrale, schéma `cockpit`).
Le hook `.claude/hooks/cockpit-session-start.sh` injecte l'état au démarrage :
chantiers ouverts par section, questions en attente, réponses humaines,
demandes des utilisateurs, progression des autres sessions.

- **RÉPONSES À RAPHAËL : simples, courtes, nettes, précises** (29 sept. : « je
  veux des réponses simples, courtes, nettes et précises ; pas de pavé »).
  Quelques lignes : la réponse d'abord, puis ce qu'il doit faire s'il y a
  quelque chose. Pas de détail technique sauf s'il le demande.
- **TES QUESTIONS RESTENT À JOUR** (29 sept. : « je ne veux pas répondre à
  des choses déjà faites, déjà répondues ou en cours »). Dès que tu avances sur
  un chantier où tu as une question ouverte : `scripts/cockpit-demander.sh
  --confirmer <id>` si elle compte encore, `--retirer <id> "pourquoi"` sinon.
  Le hook te le rappelle ; l'app marque « Claude a avancé depuis ».
- **RÈGLE DE CLARTÉ — tout ce que Raphaël lit dans le cockpit** (questions,
  constats à faire, « comment vérifier », titres, messages du fil) : le plus
  simple possible, pour quelqu'un qui ne code pas. On doit comprendre **le
  sujet**, **ce qu'il y a à faire**, et pouvoir **répondre d'un toucher**. Une
  question = une phrase (140 car.) + un pourquoi en mots de tous les jours +
  2 à 4 réponses toutes prêtes, chacune disant ce qui se passe si on la
  choisit. Pas de jargon, pas d'identifiant, pas de chiffres techniques : le
  détail va dans le fil. Les scripts refusent ce qui dépasse (Raphaël, 29 sept. :
  « dans 80 % des cas je ne comprends pas, donc je ne peux pas répondre »).
- **Chaque demande de travail de Raphaël → un chantier, AVANT de coder** :
  `scripts/cockpit-chantier.sh --ouvrir "<titre court>" --demande "<ses mots>" --section "<rubrique>"`.
  Il reprend (ou rouvre) le chantier existant au lieu d'en créer un doublon.
  **C'est TOI qui tranches, jamais Raphaël** (ses mots, 29 sept. 2026 :
  « personne mieux que Claude sait si c'est un doublon […] ce n'est pas à moi
  de trier, catégoriser à chaque fois ») : sur « ambigu », lis les extraits
  affichés et relance avec `--id <le bon>` ou `--nouveau`, sans lui demander.
  Range toujours dans une section (`--section`, créée si elle n'existe pas ;
  après coup : `--ranger <id> --section "…"`). Si deux chantiers existants
  sont en fait le même sujet, **suggère** la fusion :
  `--suggerer-fusion <id à absorber> --dans <id qui reste> --pourquoi "…"` —
  il l'accepte d'un toucher dans l'app. Un rappel le redit à chaque message
  (hook `cockpit-prompt-rappel.sh`).
- **Tes agents et tes commandes longues sont suivis tout seuls** (hook
  `cockpit-suivi.sh` : Raphaël voit dans le cockpit chaque session, ses agents,
  depuis quand ils tournent). Ce qui ne se devine pas, c'est leur avancement :
  **dans la consigne de CHAQUE agent que tu lances**, écris-lui d'appeler
  `scripts/cockpit-progression.sh --agent "<la description exacte que tu lui
  as donnée>" --chantier <id> --etape "…" --pct N --eta 10m` à chaque étape,
  et `--agent "…" --termine "…"` à la fin. Donne des descriptions d'agents
  lisibles par Raphaël (le sujet, pas la technique).
- **Limite d'usage et mode autonome** : la reprise de la tâche en cours quand
  une limite se lève est native (`autoContinueAtUsageLimit`, posé par
  brancher.sh). Si le projet est en « mode autonome » (allumé par Raphaël
  jusqu'à une heure), le hook `cockpit-autonome.sh` te donne à la fin de ta
  tâche le chantier LIBRE suivant, déjà réservé : suis ses règles (aucune
  dépense, aucune suppression, aucun envoi ; une décision de Raphaël → une
  question dans le cockpit, puis passe au suivant).
- **Réserver avant de toucher** : `scripts/cockpit-sql.sh "select reserver_chantier('<id>', '<ta branche>', 120)"`
  (false = une autre session l'a). Libérer : `liberer_chantier(id, branche)`.
- **Progression en direct, à chaque étape et en terminant** :
  `scripts/cockpit-progression.sh --chantier "<titre ou id>" --etape "…" --pct 40 --eta 25m`,
  les étapes de mise en ligne au fil de l'eau : `--jalon pousse --detail <commit>`,
  `--jalon ci-ok`, `--jalon en-ligne --detail <adresse vérifiée>` (ou
  `--jalon pas-en-ligne --detail <raison>`), puis `--termine "…" --verifier "1. … 2. … 3. Tu dois voir …"` (le chantier
  passe « à vérifier » ; `--verifier` est obligatoire : où aller, quoi faire,
  ce que Raphaël doit voir, sans jargon) ou `--echec "…"`.
  Le même tableau s'affiche dans la session : c'est le visuel de progression.
- **Une question à un humain** : `scripts/cockpit-demander.sh --chantier … --question … --pourquoi … --option "libellé|aide|recommande"`
  (`--action` pour quelque chose qu'il doit faire). Jamais dans un artefact.
- **Photos, vidéos, fichiers de Raphaël** (joints à ses réponses dans l'app, 📎 dans le hook) : `scripts/cockpit-media.sh --message <id>` ou `--chantier <id>` les télécharge ; REGARDE-les (Read sur l'image) avant de répondre.
- **Le cycle** est une colonne `etat` : à trier → à cadrer → libre → en cours →
  à vérifier → validé (+ bloqué, reporté). **Seul un humain pose « validé »**
  (bouton « Ça fonctionne, je certifie » ; « Corriger » complète la demande sur
  la même ligne et rend le chantier). Plus aucun marqueur entre crochets.
- **Écrire dans le fil** : `insert into messages (projet_id, chantier_id, auteur, auteur_type, kind, corps)`
  (`kind` info / blocage). Avant de t'arrêter, écris où tu en es.
- **Ces commandes sont des lanceurs** (`scripts/cockpit-lanceur.sh`) : elles
  exécutent toujours la dernière version publiée sur Cockpit-General, sans
  réinstallation. Ne les modifie pas ici ; une évolution se fait dans
  Cockpit-General et arrive dans tous les projets branchés en 10 minutes.
- `scripts/cockpit-sql.sh` vise le schéma `cockpit` sans préfixe, une instruction par appel ;
  demande à Raphaël avant tout drop / delete massif / truncate.
<!-- fin du bloc cockpit : brancher.sh remplace tout ce qui précède jusqu'au titre -->
