#!/usr/bin/env bash
# Déploie une fonction serveur Supabase depuis le dépôt, sans passer par un outil qui
# réclame une validation humaine à chaque appel.
#
#   scripts/deploy-fonction.sh photo-ia
#
# Exige SUPABASE_ACCESS_TOKEN dans l'environnement (jeton de compte Supabase). Ne JAMAIS
# écrire ce jeton dans un fichier du dépôt.
#
# verify_jwt reste à FALSE volontairement pour `photo-ia` et `embellish` : la clé publiable
# de l'application est elle-même un JWT valide, la vérification générique de Supabase
# laisserait donc passer n'importe qui. Le vrai contrôle est `requireUser` dans la fonction.
set -euo pipefail

SLUG="${1:?usage: deploy-fonction.sh <slug>}"
PROJET="${SUPABASE_PROJECT_REF:-njaamykxnvohoesrtpvv}"
SRC="supabase/functions/$SLUG/index.ts"
[ -f "$SRC" ] || { echo "source introuvable : $SRC" >&2; exit 1; }
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || { echo "SUPABASE_ACCESS_TOKEN manquant dans l'environnement" >&2; exit 1; }

META=$(printf '{"name":"%s","entrypoint_path":"index.ts","verify_jwt":false}' "$SLUG")

curl -sS -X POST \
  "https://api.supabase.com/v1/projects/$PROJET/functions/deploy?slug=$SLUG" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F "metadata=$META;type=application/json" \
  -F "file=@$SRC;filename=index.ts;type=application/typescript"
echo
