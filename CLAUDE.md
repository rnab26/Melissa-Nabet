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
