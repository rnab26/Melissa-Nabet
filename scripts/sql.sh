#!/usr/bin/env bash
# Exécute du SQL sur le projet Supabase sans validation manuelle de Raphaël.
#
# Pourquoi ce script existe : l'outil MCP Supabase (execute_sql) impose un pop-up à
# chaque appel, imposé par le serveur MCP et impossible à désactiver — bloquant pour
# une session autonome, qui n'a personne devant l'écran pour cliquer. Raphaël a demandé
# le 6 sept. 2026 que les sessions cessent de lui redemander d'exécuter du SQL à sa
# place. Repris du dépôt Jarvis-assistant (scripts/sql.sh), qui a le même besoin depuis
# le 3 sept. 2026 : même mécanisme, fonction public.exec_sql (voir la migration qui la
# crée), autre projet Supabase.
#
# Usage :
#   scripts/sql.sh "select id, titre from chantiers where statut <> 'livre';"
#   echo "update chantiers set statut='livre' where id='...';" | scripts/sql.sh
#   scripts/sql.sh < requete.sql
#
# Prérequis : la variable d'environnement SUPABASE_SERVICE_ROLE_KEY_MELISSA (nom
# distinct de celle du projet Jarvis, SUPABASE_SERVICE_ROLE_KEY — les deux vivent dans
# le même environnement cloud, une clé sous le même nom écraserait l'autre), définie
# dans l'environnement cloud Claude Code, ou l'en-tête posé par le proxy pour l'hôte
# njaamykxnvohoesrtpvv.supabase.co précisément. Jamais dans le dépôt.
#
# RAPPEL : cette clé donne un accès total à la base. On demande à Raphaël avant
# tout drop, delete massif ou truncate.

set -euo pipefail

URL="${SUPABASE_URL:-https://njaamykxnvohoesrtpvv.supabase.co}"

# Deux façons d'être authentifié, et le script s'accommode des deux :
#
# 1. En-tête posé par le proxy (le bon mode, si Raphaël l'a enregistré pour cet
#    hôte dans les « API credentials » de l'environnement cloud). La clé n'existe
#    alors nulle part dans la session.
#
# 2. Clé en variable d'environnement (mode historique). On pose les en-têtes
#    nous-mêmes. La clé est alors lisible par toute session de l'environnement.
#
# Supabase exige l'en-tête `apikey` ; `Authorization` seul renvoie 401.
entetes=(-H "Content-Type: application/json")
if [ -n "${SUPABASE_SERVICE_ROLE_KEY_MELISSA:-}" ]; then
  entetes+=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY_MELISSA"
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY_MELISSA")
fi

# La requête vient du premier argument, sinon de l'entrée standard.
if [ $# -gt 0 ]; then
  requete="$1"
else
  requete="$(cat)"
fi

if [ -z "${requete//[[:space:]]/}" ]; then
  echo "Erreur : aucune requête fournie." >&2
  exit 2
fi

# jq construit le JSON, pour que guillemets, apostrophes et sauts de ligne de la requête
# soient échappés correctement.
corps="$(jq -n --arg q "$requete" '{query: $q}')"

reponse="$(curl -sS --max-time 60 -X POST "$URL/rest/v1/rpc/exec_sql" \
  "${entetes[@]}" -d "$corps")"

# Réponse inattendue (erreur PostgREST, HTML d'un proxy...) : on la montre telle quelle.
if ! echo "$reponse" | jq -e 'type == "object" and has("ok")' >/dev/null 2>&1; then
  echo "Réponse inattendue de Supabase :" >&2
  echo "$reponse" >&2
  if [ -z "${SUPABASE_SERVICE_ROLE_KEY_MELISSA:-}" ]; then
    cat >&2 <<'FIN'

Aucune clé dans l'environnement (SUPABASE_SERVICE_ROLE_KEY_MELISSA absente), et la
requête n'a pas abouti : l'« API credential » de l'environnement cloud n'est
probablement pas en place pour njaamykxnvohoesrtpvv.supabase.co, ou son en-tête
n'est pas nommé « apikey » avec un préfixe vide. À vérifier dans claude.ai > Code >
environnement > API credentials. En attendant, repasser par l'outil MCP Supabase
(avec le pop-up) et le signaler à Raphaël — il doit déposer la clé service_role de
CE projet (Melissa Nabet), pas celle de Jarvis.
FIN
  fi
  exit 1
fi

echo "$reponse" | jq .

# Code de sortie non nul si le SQL a échoué, pour que l'échec ne passe pas inaperçu.
if [ "$(echo "$reponse" | jq -r '.ok')" != "true" ]; then
  exit 1
fi
