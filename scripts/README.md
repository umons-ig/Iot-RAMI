# Scripts d'exploitation RAMI

## `db-backup.sh` — sauvegarde de la base TimescaleDB

Effectue un `pg_dump` du conteneur TimescaleDB (`iot-rami-db`), ecrit un dump
compresse et horodate, puis fait tourner les anciens dumps (rotation).

### Prerequis

- Docker installe et conteneur `iot-rami-db` demarre (stack `docker-compose.yml`).
- Droits suffisants pour ecrire dans `BACKUP_DIR` et pour `docker exec`.

### Utilisation

```bash
./scripts/db-backup.sh
```

Le script est idempotent : chaque execution produit un nouveau dump date, sans
effet de bord sur les precedents (hormis la rotation).

### Variables d'environnement

| Variable     | Defaut               | Description                          |
| ------------ | -------------------- | ------------------------------------ |
| `CONTAINER`  | `iot-rami-db`        | Nom du conteneur TimescaleDB         |
| `DB_USER`    | `postgres`           | Utilisateur PostgreSQL               |
| `DB_NAME`    | `postgres`           | Base a sauvegarder                   |
| `BACKUP_DIR` | `/var/backups/rami-db` | Repertoire de destination          |
| `RETAIN`     | `7`                  | Nombre de dumps a conserver          |

Exemple en surchargeant la config :

```bash
DB_USER=rami DB_NAME=rami BACKUP_DIR=/srv/backups RETAIN=14 ./scripts/db-backup.sh
```

### Automatisation via cron

Sauvegarde quotidienne a 03h00, avec les memes valeurs que la stack (a adapter) :

```cron
0 3 * * * DB_USER=rami DB_NAME=rami BACKUP_DIR=/srv/backups RETAIN=14 /chemin/vers/Iot-RAMI/scripts/db-backup.sh >> /var/log/rami-db-backup.log 2>&1
```

> Les valeurs `DB_USER` / `DB_NAME` doivent correspondre a celles du `.env`
> (`DB_USER`, `DB_NAME`) utilisees par le conteneur TimescaleDB.

### Restauration

```bash
gunzip -c /var/backups/rami-db/<DB_NAME>-<timestamp>.sql.gz \
  | docker exec -i iot-rami-db psql --username <DB_USER> --dbname <DB_NAME>
```

Le dump est genere avec `--clean --if-exists`, la restauration est donc
rejouable sur une base existante.
