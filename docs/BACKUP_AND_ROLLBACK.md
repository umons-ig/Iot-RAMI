# Sauvegardes & rollback — RAMI 1.0

> Réponse aux écarts §3.4 (backups) et §3.6 (stratégie de déploiement / rollback)
> de [`PLAN_AMELIORATIONS.md`](./PLAN_AMELIORATIONS.md).

## 1. Sauvegarde de la base (TimescaleDB cloud)

Le volume Docker `db-data` est aujourd'hui l'**unique copie** des données au cloud.
Au-delà de la rétention de l'outbox fog (`OUTBOX_RETENTION_DAYS`, 7 j par défaut),
il n'existe **aucune redondance** : une défaillance du stockage du Pi = perte de
tout l'historique. D'où une sauvegarde régulière, **hors du Pi**.

### Lancer une sauvegarde

```bash
# Dump compressé horodaté dans ./backups (rotation : 14 derniers)
./scripts/backup-db.sh

# Destination hors-Pi (recommandé : NAS monté, bucket S3-compatible monté…)
BACKUP_DIR=/mnt/nas/rami ./scripts/backup-db.sh
```

Variables : `DB_CONTAINER` (défaut `iot-rami-db`), `DB_USER`, `DB_NAME`,
`BACKUP_DIR`, `BACKUP_RETENTION`.

### Automatiser (cron)

```cron
# Tous les jours à 3h
0 3 * * * /chemin/vers/scripts/backup-db.sh >> /var/log/rami-backup.log 2>&1
```

> ⚠️ Une sauvegarde **sur le même disque** que la base ne protège pas d'une panne
> de ce disque. Viser un stockage distant (NAS, objet S3). Combiner avec la
> migration des volumes critiques sur SSD (§3.5).

### Restaurer

```bash
# Restauration dans la base existante (le dump contient --clean --if-exists)
gunzip -c backups/rami-postgres-AAAAMMJJ-HHMMSS.sql.gz \
  | docker exec -i iot-rami-db psql -U "$DB_USER" -d "$DB_NAME"
```

Vérifier ensuite que les hypertables/continuous aggregates TimescaleDB sont bien
présents (le dump logique les recrée ; pour un PITR complet, envisager
`pg_basebackup` + WAL archiving — hors scope ici).

---

## 2. Stratégie de déploiement & rollback (Watchtower)

### Situation

Watchtower suit le tag `:latest` et redéploie automatiquement (poll 300 s) :
**tout merge sur `main` part en prod en < 5 min**, sans validation ni fenêtre, et
`WATCHTOWER_CLEANUP: "true"` supprime l'ancienne image → **pas de rollback trivial**.

### Procédure de rollback (images `:sha` immuables poussées par la CI)

La CI pousse aussi un tag immuable par commit (`:<sha>`). Pour revenir en arrière :

```bash
# 1. Identifier le SHA de la version saine (GHCR ou historique git)
PREV=ghcr.io/umons-ig/iot-rami-backend:<sha_precedent>

# 2. Re-taguer en :latest (ou en :stable, cf. ci-dessous) et redéployer
docker pull "$PREV"
docker tag "$PREV" ghcr.io/umons-ig/iot-rami-backend:latest
docker compose up -d node-backend
```

### Évolution recommandée : promotion vers `:stable`

Plutôt que de laisser Watchtower suivre `:latest`, le faire suivre un tag
`:stable` **promu manuellement** après validation :

```yaml
# docker-compose.yml — exemple
node-backend:
  image: ghcr.io/umons-ig/iot-rami-backend:stable
watchtower:
  # surveille uniquement les images :stable
  command: iot-rami-backend iot-rami-frontend
```

Promotion d'une version validée :

```bash
docker pull ghcr.io/umons-ig/iot-rami-backend:<sha_valide>
docker tag  ghcr.io/umons-ig/iot-rami-backend:<sha_valide> \
            ghcr.io/umons-ig/iot-rami-backend:stable
docker push ghcr.io/umons-ig/iot-rami-backend:stable
```

> Ce changement de politique n'est **pas** appliqué automatiquement (il modifie
> le flux de déploiement que tu utilises). À activer quand tu veux passer d'un
> déploiement continu à un déploiement promu/validé.

### Compléments CI (suite)

- Rendre **gitleaks** bloquant (actuellement `continue-on-error`).
- Ajouter un **smoke test** du conteneur assemblé (santé `/health`) avant push.
