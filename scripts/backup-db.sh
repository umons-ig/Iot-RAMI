#!/usr/bin/env bash
#
# Sauvegarde de la base TimescaleDB cloud (PLAN_AMELIORATIONS §3.4).
#
# Le volume `db-data` est aujourd'hui l'UNIQUE copie des données au cloud : si le
# stockage du Pi lâche, tout l'historique est perdu au-delà de la rétention fog
# (7 j). Ce script effectue un pg_dump compressé horodaté et applique une
# rotation (conserve les N plus récents).
#
# Usage :
#   ./scripts/backup-db.sh                 # dump dans ./backups
#   BACKUP_DIR=/mnt/nas/rami ./scripts/backup-db.sh
#
# Cron (quotidien à 3h, hors-Pi de préférence — monter un NAS/objet S3) :
#   0 3 * * * /chemin/vers/scripts/backup-db.sh >> /var/log/rami-backup.log 2>&1
#
# ⚠️ Pour une vraie résistance aux pannes, la destination DOIT être HORS du Pi
# (NAS, bucket S3-compatible…) : une sauvegarde sur le même disque ne protège pas
# d'une défaillance de ce disque.

set -euo pipefail

# --- Configuration (surchargeable par l'environnement) -----------------------
CONTAINER="${DB_CONTAINER:-iot-rami-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${BACKUP_RETENTION:-14}" # nombre de dumps à conserver

timestamp="$(date +%Y%m%d-%H%M%S)"
outfile="${BACKUP_DIR}/rami-${DB_NAME}-${timestamp}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] pg_dump ${DB_NAME} depuis le conteneur ${CONTAINER} -> ${outfile}"
# --clean --if-exists : le dump peut être rejoué pour restaurer en place.
docker exec "${CONTAINER}" pg_dump \
  --username="${DB_USER}" \
  --clean --if-exists \
  "${DB_NAME}" | gzip > "${outfile}"

echo "[backup] OK ($(du -h "${outfile}" | cut -f1))"

# --- Rotation : supprime les dumps les plus anciens au-delà de la rétention ---
mapfile -t old < <(ls -1t "${BACKUP_DIR}"/rami-*.sql.gz 2>/dev/null | tail -n +"$((RETENTION + 1))")
if [ "${#old[@]}" -gt 0 ]; then
  echo "[backup] Rotation : suppression de ${#old[@]} ancien(s) dump(s)"
  rm -f "${old[@]}"
fi

echo "[backup] Terminé."
