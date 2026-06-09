# Conception — Rétention locale & store-and-forward sur le fog

> Document de conception (non encore implémenté). Objectif : faire du nœud fog la **source de
> vérité locale durable** des données médicales, le cloud devenant un réplica. Ce chantier
> résout aussi la **perte de données** identifiée à l'audit (buffer mémoire pur, drop silencieux
> si Kafka tombe — voir [`ETAT_DES_LIEUX.md`](./ETAT_DES_LIEUX.md), item #7).

## 1. Pourquoi

- **Donnée médicale = pas de perte tolérable.** Aujourd'hui les mesures vivent en RAM dans le
  fog et sont droppées si le buffer sature (Kafka indisponible > ~2-3 s) ou perdues au redémarrage.
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
                          [3] marque status=synced (après ACK Kafka)
                                   │
                          [4] purge selon politique de rétention
```

- **[1] Write-ahead** : toute mesure reçue est d'abord **persistée localement** avant tout envoi
  réseau. C'est l'invariant clé : on ne perd jamais une mesure acquittée au capteur.
- **[2] Réplication découplée** : un worker lit les lignes `pending` par lots et les publie sur
  Kafka. Indépendant du débit d'ingestion MQTT.
- **[3] Confirmation** : une ligne passe `synced` uniquement après ACK Kafka. En cas d'échec, elle
  reste `pending` et sera re-tentée (idempotence côté backend via clé `sensorTopic`+`timestamp`).
- **[4] Rétention** : purge des lignes `synced` plus vieilles que `RETENTION_DAYS` (politique
  explicite, exigée pour des données de santé).

## 3. Choix techniques

| Sujet | Recommandation | Justification |
|-------|----------------|---------------|
| Store local | **SQLite** (mode WAL) | Transactionnel, zéro serveur, idéal sur Pi. Alternative : `better-sqlite3` (sync, rapide) ou `level`. TimescaleDB complet = trop lourd en edge. |
| Support physique | **SSD USB** (pas la carte SD) | La SD s'use vite en écriture et se corrompt → inadapté à un journal append-only médical. |
| Chiffrement at-rest | **LUKS** sur le volume, ou SQLCipher | Un Pi peut être volé. Données de santé = chiffrement obligatoire. |
| Schéma | table `measurements_outbox(id, sensor_topic, payload_json, ts, status, created_at, synced_at)` + index sur `(status, ts)` | Requête `WHERE status='pending' ORDER BY ts LIMIT n` performante. |
| Idempotence | clé logique `(sensor_topic, timestamp)` | Permet au backend de dédupliquer en cas de re-publication. |

## 4. Intégration dans le fog existant

- Remplacer la `Map<string, any[]>` en mémoire de `mqttFog.ts` par un module
  `persistentOutbox` (interface : `append(topic, measure)`, `pullPending(limit)`,
  `markSynced(ids)`, `purgeSynced(before)`).
- `handleMeasurement` → `outbox.append(...)` (au lieu de `buffer.push`).
- Le `flushInterval` actuel devient le **réplicateur** : `pullPending` → `publishBatch` Kafka →
  `markSynced`.
- Au **démarrage**, le réplicateur reprend naturellement les `pending` survivants (remplace la
  perte au reboot). `shutdown()` n'a plus besoin de flusher la RAM (déjà sur disque) mais ferme
  proprement la base.
- Conserver un **plafond** (taille disque) avec alerte/métrique plutôt qu'un drop silencieux.

## 5. Conformité (données de santé — RGPD art. 9)

- **Minimisation & pseudonymisation** : ne stocker localement que l'identifiant capteur, pas
  d'identité patient en clair si évitable.
- **Durée de conservation** explicite et documentée (`RETENTION_DAYS`).
- **Traçabilité** : journaliser les purges.
- **Chiffrement** at-rest (cf. §3) et en transit (cf. sécurisation fog→Kafka dans
  `ETAT_DES_LIEUX.md` : WireGuard / SASL_SSL).

## 6. Étapes d'implémentation suggérées

1. Module `persistentOutbox` + schéma SQLite + tests unitaires (append/pull/markSynced/purge).
2. Brancher `handleMeasurement` sur l'outbox (write-ahead) — garder l'ACK capteur après write.
3. Convertir le flush en réplicateur (pull → publish → markSynced), gestion d'échec Kafka.
4. Replay au démarrage + métriques (pending count, lag, purges).
5. Tests de panne : Kafka down prolongé, reboot fog, disque plein.
6. Chiffrement at-rest (LUKS/SQLCipher) + politique de rétention.

> ⚠️ Chantier sur le **chemin de données critique** : à implémenter et valider sur hardware réel
> (Pi + SSD), avec tests de panne, avant mise en production.
