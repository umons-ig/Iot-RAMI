# Rétention locale & store-and-forward sur le fog

> Objectif : faire du nœud fog la **source de vérité locale durable** des données médicales,
> le cloud devenant un réplica. Ce chantier résout aussi la **perte de données** identifiée à
> l'audit (buffer mémoire pur, drop silencieux si Kafka tombe — voir
> [`ETAT_DES_LIEUX.md`](./ETAT_DES_LIEUX.md), item #7).
>
> **Statut : implémenté.** Store local = **PostgreSQL local en conteneur** (driver `pg`).

## 1. Pourquoi

- **Donnée médicale = pas de perte tolérable.** Avant ce chantier, les mesures vivaient en RAM
  dans le fog et étaient droppées si le buffer saturait (Kafka indisponible > ~2-3 s) ou perdues
  au redémarrage.
- **Souveraineté / résilience.** Le fog doit fonctionner même coupé du cloud, et garder une copie
  locale des données de santé.
- **Le buffer durable EST la solution de fiabilité.** Les deux besoins (rétention + anti-perte)
  ne font qu'un.

## 2. Pattern cible : store-and-forward

```
MQTT (mesure) ──► [1] écriture LOCALE durable (status=pending) ──► ACK capteur
                                   │
                          [2] réplicateur asynchrone
                                   │  publie vers Kafka quand le lien est up
                                   ▼
                          [3] marque status=synced (après succès Kafka)
                                   │
                          [4] purge selon politique de rétention
```

- **[1] Write-ahead** : tout événement reçu (`start`, lot de mesures `data`, `stop`) est d'abord
  **persisté localement** (`outbox.enqueue`) avant tout envoi réseau, et l'ACK capteur n'est émis
  qu'après cette persistance (`startSession` lève si l'enqueue échoue → pas d'ACK). C'est
  l'invariant clé : on ne perd jamais un événement acquitté au capteur.
- **[2] Réplication découplée** : un worker (`startReplicator`, tick `OUTBOX_REPLICATOR_INTERVAL_MS`)
  lit les lignes `pending` par lots (`OUTBOX_BATCH_SIZE`) et les publie sur Kafka. Indépendant du
  débit d'ingestion MQTT. Un flag `isReplicating` évite les ticks concurrents.
- **[3] Confirmation** : une ligne passe `synced` uniquement après succès Kafka (`markSynced`).
  En cas d'échec, elle reste `pending` et sera re-tentée au tick suivant.
- **[4] Rétention** : purge périodique (`startPurge`, `OUTBOX_PURGE_INTERVAL_MS`) des lignes
  `synced` plus vieilles que `OUTBOX_RETENTION_DAYS` (politique explicite, exigée pour des données
  de santé). Le nombre de lignes purgées est journalisé (traçabilité).

## 3. Choix techniques

| Sujet | Choix | Justification |
|-------|-------|---------------|
| Store local | **PostgreSQL 16 (conteneur `postgres:16-alpine`)**, driver `pg` (pur JS) | Transactionnel, JSONB natif, `ANY($1)` / intervals SQL pratiques pour l'outbox. `pg` n'a pas de build natif → fonctionne sur Alpine/ARM (Pi). Conteneur isolé avec volume durable. |
| Driver | **`pg`** (Pool, 5 connexions) | Pur JavaScript : aucune compilation native, pas de souci d'architecture (arm64/amd64). |
| Évolution time-series | **TimescaleDB** (même protocole wire Postgres) | On peut remplacer l'image par `timescale/timescaledb` et convertir `outbox` en hypertable pour de la rétention/compression time-series, sans changer le code applicatif (`pg`). |
| Support physique | **SSD USB** (pas la carte SD) | La SD s'use vite en écriture et se corrompt → inadapté à un journal append-only médical. Monter le volume `fog-db-data` sur le SSD. |
| Chiffrement at-rest | **LUKS** sur le volume hôte | Un Pi peut être volé. Données de santé = chiffrement obligatoire. Chiffrer le volume Docker sous-jacent. |
| Schéma | table `outbox(id BIGSERIAL, sensor_topic TEXT, payload JSONB, status TEXT, created_at, synced_at)` + index partiel `WHERE status='pending'` | Requête `WHERE status='pending' ORDER BY id ASC LIMIT n` performante grâce à l'index partiel. |
| Idempotence | clé logique `(sensorTopic, timestamp)` dans le payload | Permet au backend de dédupliquer en cas de re-publication (un lot republié après un échec partiel). |

### Schéma SQL

```sql
CREATE TABLE IF NOT EXISTS outbox (
  id BIGSERIAL PRIMARY KEY,
  sensor_topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox (id) WHERE status = 'pending';
```

## 4. Intégration dans le fog

Fichiers : `fog-service/src/outbox.ts` (module `Outbox`), `fog-service/src/mqttFog.ts` (flux),
`fog-service/src/constants.ts` (`PG_CONFIG`, `OUTBOX_CONFIG`).

- **`Outbox`** encapsule un `pg.Pool`. API : `init()`, `enqueue(event)`, `pullPending(limit)`,
  `markSynced(ids)`, `purgeSynced(retentionDays)`, `pendingCount()`, `close()`.
- **`startSession`** → `outbox.enqueue({ type: "start", sensorTopic, timestamp })` (au lieu de
  publier START directement vers Kafka). L'ACK capteur n'est émis qu'après persistance réussie.
- **`flushBuffer`** → construit `{ type: "data", sensorTopic, measures }` et
  `outbox.enqueue(...)` (écriture locale rapide et durable), puis vide le buffer mémoire.
- **`handleStop`** → `flushBuffer` (persiste le reste) puis
  `outbox.enqueue({ type: "stop", ... })`, puis supprime le buffer.
- **Réplicateur** (`startReplicator` / `replicate`) : remplace l'ancien rôle direct du flush.
  `pullPending` → `publishBatchSensorData` → `markSynced` ; échec Kafka = pas de `markSynced`.
- **Au démarrage**, le réplicateur reprend naturellement les `pending` survivants (remplace la
  perte au reboot — pas de replay spécial à coder).
- **`shutdown()`** : stoppe replicator/purge/flush, persiste les buffers mémoire restants vers
  l'outbox, déconnecte Kafka, ferme MQTT, puis `outbox.close()`. Les `pending` non encore
  répliqués survivent et repartent au prochain démarrage.
- Le **buffer mémoire** + `MAX_BUFFER_SIZE` restent comme micro-batch (filet de sécurité), mais
  comme le flush écrit en DB toutes les `FLUSH_INTERVAL_MS` (200 ms) le drop ne devrait plus
  arriver.

## 5. Déploiement (compose fog)

`fog-service/compose.yaml` ajoute un service `postgres` (`postgres:16-alpine`) avec :

- volume durable `fog-db-data` (à placer sur le SSD, chiffré LUKS) ;
- healthcheck `pg_isready` ;
- `deploy.resources.limits.memory: 512m` (compatible cgroup v2 sur le Pi) ;
- `fog-service` dépend de `postgres` avec `condition: service_healthy` et reçoit
  `PG_HOST=postgres`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`.

Variables d'environnement documentées dans `fog-service/.env.example` (`PG_*` + `OUTBOX_*`).

## 6. Conformité (données de santé — RGPD art. 9)

- **Minimisation & pseudonymisation** : ne stocker localement que l'identifiant capteur
  (`sensor_topic`), pas d'identité patient en clair si évitable.
- **Durée de conservation** explicite et documentée (`OUTBOX_RETENTION_DAYS`).
- **Traçabilité** : les purges sont journalisées (nombre de lignes supprimées).
- **Chiffrement** at-rest (LUKS sur le volume `fog-db-data`) et en transit (sécurisation
  fog→Kafka dans `ETAT_DES_LIEUX.md` : WireGuard / SASL_SSL — le défaut reste PLAINTEXT sur subnet
  local de confiance).

## 7. Tests de panne à valider sur hardware réel

> ⚠️ Chantier sur le **chemin de données critique** : valider sur Pi + SSD avant production.

1. **Kafka down prolongé** : les lignes restent `pending`, `pendingCount` croît, aucune perte ;
   au retour de Kafka, le réplicateur draine la backlog.
2. **Reboot fog** : les `pending` survivent au volume Postgres et sont répliqués au démarrage.
3. **Disque plein** : surveiller `pendingCount` + espace disque (métrique/alerte plutôt qu'un drop
   silencieux).
