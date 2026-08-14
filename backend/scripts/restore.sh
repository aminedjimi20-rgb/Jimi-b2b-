#!/usr/bin/env bash
# JIMI B2B — restore a backup produced by BackupService (src/backup).
#
# Deliberately a CLI script, not an API endpoint: restoring overwrites the
# live database and must be a conscious, authenticated-to-the-server action
# by whoever operates the deployment — never a tap in the mobile app (see
# docs/ARCHITECTURE.md §10).
#
# Usage: ./scripts/restore.sh /path/to/jimi-b2b-<timestamp>.sql.gz
set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <chemin-vers-backup.sql.gz>" >&2
  exit 1
fi
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Fichier introuvable: $BACKUP_FILE" >&2
  exit 1
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL doit être défini dans l'environnement." >&2
  exit 1
fi

# Strip Prisma-only query params (schema=...) the same way BackupService does —
# psql rejects them just like pg_dump does.
CLEAN_URL=$(node -e "const u=new URL(process.env.DATABASE_URL); u.search=''; console.log(u.toString());")

echo "Cette opération va ÉCRASER la base de données cible avec le contenu de:"
echo "  $BACKUP_FILE"
echo "Base cible: $CLEAN_URL"
read -r -p "Taper 'RESTORE' pour confirmer: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Annulé."
  exit 1
fi

gunzip -c "$BACKUP_FILE" | psql "$CLEAN_URL"
echo "Restauration terminée."
