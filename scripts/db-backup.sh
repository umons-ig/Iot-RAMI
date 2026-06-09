#!/usr/bin/env bash
#
# db-backup.sh — Sauvegarde horodatee de la base TimescaleDB du projet RAMI.
#
# Effectue un pg_dump depuis le conteneur Docker de la base, ecrit un dump
# compresse horodate dans BACKUP_DIR, puis applique une rotation en ne
# conservant que les RETAIN derniers dumps. Idempotent : peut etre relance
# sans effet de bord (chaque execution cree un nouveau dump date).
#
# Usage :
#   ./scripts/db-backup.sh
#
# Variables surchargeables via l'environnement (voir scripts/README.md).

set -euo pipefail

# ─── Configuration (surchargeable via variables d'environnement) ───────────
CONTAINER="${CONTAINER:-iot-rami-db}"          # nom du conteneur TimescaleDB
DB_USER="${DB_USER:-postgres}"                  # utilisateur PostgreSQL
DB_NAME="${DB_NAME:-postgres}"                  # base a sauvegarder
BACKUP_DIR="${BACKUP_DIR:-/var/backups/rami-db}" # repertoire de destination
RETAIN="${RETAIN:-7}"                           # nombre de dumps a conserver
# ───────────────────────────────────────────────────────────────────────────

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTFILE="${BACKUP_DIR}/${DB_NAME}-${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[db-backup] Dump de '${DB_NAME}' depuis le conteneur '${CONTAINER}'..."

# pg_dump dans le conteneur, sortie compressee cote hote.
# --clean --if-exists rend la restauration idempotente.
if docker exec "${CONTAINER}" pg_dump \
    --username "${DB_USER}" \
    --clean --if-exists \
    "${DB_NAME}" | gzip > "${OUTFILE}.tmp"; then
  mv "${OUTFILE}.tmp" "${OUTFILE}"
  echo "[db-backup] Dump cree : ${OUTFILE} ($(du -h "${OUTFILE}" | cut -f1))"
else
  rm -f "${OUTFILE}.tmp"
  echo "[db-backup] ECHEC du dump." >&2
  exit 1
fi

# ─── Rotation : on ne garde que les ${RETAIN} dumps les plus recents ────────
echo "[db-backup] Rotation : conservation des ${RETAIN} derniers dumps."
# shellcheck disable=SC2012
ls -1t "${BACKUP_DIR}/${DB_NAME}-"*.sql.gz 2>/dev/null \
  | tail -n "+$((RETAIN + 1))" \
  | while read -r old; do
      echo "[db-backup] Suppression de l'ancien dump : ${old}"
      rm -f "${old}"
    done

echo "[db-backup] Termine."
