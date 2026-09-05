#!/bin/bash
# Démarrage d'une session sur ce dépôt.
#
# Deux choses, et rien d'autre :
#   1. installer de quoi lancer les tests (Playwright), sinon chaque session doit y penser ;
#   2. AFFICHER L'ÉTAT DU PROJET, pour qu'une session neuve n'ait rien à se faire coller.
#
# Volontairement bavard sur l'état, silencieux sur le reste : ce qui est écrit ici arrive
# dans le contexte de la session.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# --- 1. Dépendances de test (uniquement dans l'environnement cloud) ---
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if [ ! -d node_modules/playwright ]; then
    npm install --silent --no-audit --no-fund playwright@1.49.1 >/dev/null 2>&1 \
      && echo "Playwright installé (tests prêts)." \
      || echo "ATTENTION : l'installation de Playwright a échoué — les tests navigateur ne tourneront pas."
  fi
fi

# --- 2. État du projet ---
echo ""
echo "===== ÉTAT DU PROJET (chargé automatiquement) ====="
echo ""
echo "Trois documents font foi, dans cet ordre :"
echo "  - CLAUDE.md          : les consignes de travail (à lire, elles priment)"
echo "  - docs/journal.md    : où en est le travail, ce qu'il ne faut pas casser"
echo "  - PROJECT_LOG.md     : le détail technique, chantier par chantier"
echo ""
echo "Tableau des chantiers (source de vérité de ce qui reste à faire) :"
echo "  https://claude.ai/code/artifact/c7ead2fa-509a-4bf4-a2c5-ac18a5063d84"
echo ""

if [ -f docs/journal.md ]; then
  echo "--- Dernières entrées du journal ---"
  grep -n '^## ' docs/journal.md | tail -6 | sed 's/^[0-9]*:## /  · /'
  echo ""
fi

echo "--- Cinq derniers commits ---"
git log --oneline -5 2>/dev/null | sed 's/^/  /'
echo ""

MODIFS="$(git status --porcelain 2>/dev/null | head -5)"
if [ -n "$MODIFS" ]; then
  echo "--- Travail non commité en cours ---"
  echo "$MODIFS" | sed 's/^/  /'
  echo ""
fi

echo "--- Vérification (méthode de référence, ne pas la remplacer par une relecture) ---"
echo "  python3 -m http.server 8899 &            # depuis la racine"
echo "  node tests/realisations.test.mjs         # le CRM, navigateur réel"
echo "  node tests/sitetest-build.mjs && python3 -m http.server 8902 -d /tmp/mn-sitetest &"
echo "  node tests/site.test.mjs                 # le site public"
echo "  node tests/bout-en-bout.test.mjs         # ce que le CRM publie, lu par le site"
echo "  bun tests/pont-ia.test.mjs               # le pont de retouche IA"
echo ""
echo "==================================================="
