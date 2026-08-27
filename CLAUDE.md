# CLAUDE.md

Consignes de travail pour Claude sur ce dépôt. À lire avant toute intervention.

## Discipline de branche

- Ne jamais modifier `main` directement. Tout le travail se fait sur la branche du chantier en cours.
- Ne jamais merger ni déployer sur `main` sans demande explicite de l'utilisateur, même si un correctif est validé et testé. Proposer le merge, ne pas l'exécuter de soi-même.
- Rester sur la branche du chantier en cours pour toute la durée de ce chantier ; ne pas en changer sans raison explicite.
- Si le merge sur `main` est techniquement impossible dans la session (permissions, configuration), le dire clairement plutôt que de chercher un contournement (fork, push forcé, etc.).

## Autonomie par défaut

Ne pas demander la permission à chaque étape pour :
- corriger un bug évident repéré en cours de route,
- relancer un test après une modification,
- pousser un correctif déjà validé par un test réel sur la branche du chantier.

Demander avant toute action à risque réel : action destructive, modification de configuration partagée, merge/déploiement sur `main`, ou changement dont la portée dépasse ce qui a été demandé.

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
