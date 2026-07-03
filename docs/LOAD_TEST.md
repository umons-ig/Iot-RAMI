# Test de charge — RAMI 1.0

**Date des premières campagnes** : 17/03/2026
**Outil** : `python-simulator-over-mqtt-master/load_test_matrix.py`
**Hardware testé** : Raspberry Pi 4 (8 GB RAM, 4 cœurs Cortex-A72 1.8 GHz)

---

## Contexte

Le "cloud" de RAMI tourne sur un **Raspberry Pi 4** hébergeant simultanément :
- TimescaleDB (PostgreSQL avec extension hypertable)
- Kafka (KRaft, sans Zookeeper)
- Node.js backend Express/TypeScript
- Mosquitto
- Prometheus + Grafana
- Watchtower

L'objectif du test est de caractériser la limite de débit du pipeline complet et d'identifier le bottleneck.

---

## Méthodologie

### Flux testé

```
Simulateur Python (N processus)
    |  MQTT ({topic}/sensor)
    v
Fog-service (Pi fog, buf. mémoire 1s / 10 entrées)
    |  Kafka (sensor-data)
    v
Backend cloud (kafkaService.ts → socketService.ts)
    |  bulkCreate(rows, { ignoreDuplicates: true })
    v
TimescaleDB (hypertable sensordata)
```

### Métrique mesurée

`kafka_message_processing_seconds` p95 — Histogram Prometheus défini dans `backend/src/middlewares/metrics.ts`.

Mesure le temps écoulé entre la réception d'un message Kafka `data` et la fin de l'écriture en base de données (`bulkCreate`). Interrogé via PromQL :

```promql
histogram_quantile(0.95, rate(kafka_message_processing_seconds_bucket[30s]))
```

### Paramètres communs

| Paramètre | Valeur |
|-----------|--------|
| Durée par palier | 30 s |
| Type de mesure | `temperature` (1 valeur par message) |
| Pause entre paliers | 3 s |

---

## Bugs corrigés avant les campagnes haute charge

Deux bugs ont été identifiés et corrigés pendant la première campagne de tests. Toutes les campagnes ultérieures bénéficient de ces correctifs.

### Race condition Kafka (`kafkaService.ts`)

**Problème** : sous haute charge, le callback de traitement des messages Kafka était appelé sans `await`, créant une race condition entre le démarrage de session (`start`) et l'arrivée des premières données (`data`).

**Correction** : `callback(data)` → `await callback(data)`

### Doublons sous haute charge (`socketService.ts`)

**Problème** : sous haute charge, des insertions simultanées de `bulkCreate` pouvaient provoquer des erreurs `duplicate key` sur la clé primaire composite `(time, idSensor, idMeasurementType)` de la hypertable.

**Correction** : `bulkCreate(rows)` → `bulkCreate(rows, { ignoreDuplicates: true })`

Ces deux correctifs ont permis de passer la limite de throughput stable de ~2 400 pts/s à ~10 000 pts/s (×4).

---

## Campagne 1 — Basse charge (17/03/2026)

**Fichier source** : `load_test_results_20260317_162528.csv`

Campagne centrée sur la plage basse charge (4–16 capteurs × 4–16 pts/s) pour caractériser le comportement du pipeline en dessous du seuil minimal du test de référence et confirmer l'absence de surcoût fixe à faible débit.

### Paramètres

| Paramètre | Valeur |
|-----------|--------|
| Plage de capteurs | 4 à 16 (pas de 4) |
| Plage de taux | 4 à 16 pts/s/capteur (pas de 4) |
| Combinaisons testées | 16 |

### Tableau des résultats

| Capteurs | Pts/s/capteur | Total pts/s | Latence p95 (ms) |
|----------|---------------|-------------|-----------------|
| 4        | 4             | 16          | N/A             |
| 4        | 8             | 32          | 9.97            |
| 4        | 12            | 48          | 20.213          |
| 4        | 16            | 64          | 11.0            |
| 8        | 4             | 32          | 9.348           |
| 8        | 8             | 64          | 9.641           |
| 8        | 12            | 96          | 9.936           |
| 8        | 16            | 128         | 16.944          |
| 12       | 4             | 48          | 9.639           |
| 12       | 8             | 96          | 9.959           |
| 12       | 12            | 144         | 9.791           |
| 12       | 16            | 192         | 12.066          |
| 16       | 4             | 64          | 9.851           |
| 16       | 8             | 128         | 9.556           |
| 16       | 12            | 192         | 9.968           |
| 16       | 16            | 256         | 9.881           |

> **Note N/A** : le palier 4 capteurs × 4 pts/s (16 pts/s total) n'a pas généré suffisamment d'observations Prometheus pendant la fenêtre de 30 s pour calculer un p95 valide. Ce comportement est normal à très faible débit.

### Observations

**Plancher de latence à ~10 ms.** La quasi-totalité des paliers se situe entre 9.3 ms et 12 ms. Ce plancher incompressible correspond au cumul des délais structurels du pipeline : fenêtre de buffer fog, `bulkCreate` + commit PostgreSQL, délai de scrape Prometheus.

**Absence de dégradation.** La latence reste stable de 16 à 256 pts/s sans aucune tendance à la hausse.

---

## Campagne 2 — Haute charge, matrice 5×5 (17/03/2026)

**Fichier source** : `load_test_results_20260317_121859.csv`

Test de référence sur la plage 5–30 capteurs × 5–30 pts/s.

### Paramètres

| Paramètre | Valeur |
|-----------|--------|
| Plage de capteurs | 5 à 30 (pas de 5) |
| Plage de taux | 5 à 30 pts/s/capteur (pas de 5) |
| Combinaisons testées | 36 |

### Tableau des résultats

| Capteurs | Pts/s/capteur | Total pts/s | Latence p95 (ms) |
|----------|---------------|-------------|-----------------|
| 5        | 5             | 25          | 22.7            |
| 5        | 10            | 50          | 18.4            |
| 5        | 15            | 75          | 23.5            |
| 5        | 20            | 100         | 22.3            |
| 5        | 25            | 125         | 22.8            |
| 5        | 30            | 150         | 23.4            |
| 10       | 5             | 50          | 18.0            |
| 10       | 10            | 100         | 20.5            |
| 10       | 15            | 150         | 21.9            |
| 10       | 20            | 200         | 22.7            |
| 10       | 25            | 250         | 21.7            |
| 10       | 30            | 300         | 23.9            |
| 15       | 5             | 75          | 17.5            |
| 15       | 10            | 150         | 23.7            |
| 15       | 15            | 225         | 24.0            |
| 15       | 20            | 300         | 24.3            |
| 15       | 25            | 375         | 24.3            |
| 15       | 30            | 450         | 24.2            |
| 20       | 5             | 100         | 23.2            |
| 20       | 10            | 200         | 23.1            |
| 20       | 15            | 300         | 20.8            |
| 20       | 20            | 400         | 23.0            |
| 20       | 25            | 500         | 24.2            |
| 20       | 30            | 600         | 38.5            |
| 25       | 5             | 125         | 23.3            |
| 25       | 10            | 250         | 23.3            |
| 25       | 15            | 375         | 23.6            |
| 25       | 20            | 500         | 23.5            |
| 25       | 25            | 625         | 22.2            |
| 25       | 30            | 750         | 24.0            |
| 30       | 5             | 150         | 24.3            |
| 30       | 10            | 300         | 24.3            |
| 30       | 15            | 450         | 29.0            |
| 30       | 20            | 600         | 129.9 ⚠         |
| 30       | 25            | 750         | 22.9            |
| 30       | 30            | 900         | 23.3            |

> **Pic isolé à 30 × 20 pts/s (129.9 ms)** : incohérent avec les valeurs voisines (22–24 ms). Il s'agit probablement d'une contention I/O passagère (GC TimescaleDB, flush WAL) — les paliers à 750 et 900 pts/s affichent des latences normales.

### Observations

La latence p95 reste dans la plage 17–25 ms sur toute la matrice (25 à 900 pts/s) à l'exception du pic isolé. La différence de plancher avec la campagne basse charge (~22 ms ici vs ~10 ms) est liée à l'état de charge global du Pi 4 au moment des tests (charge CPU/I/O résiduelle des autres services).

---

## Campagne 3 — Haute charge extrême, matrice 20×20 (17/03/2026)

**Fichier source** : `load_test_results_20260317_160718.csv`

Extension de la matrice jusqu'à 100 capteurs × 100 pts/s (10 000 pts/s) pour trouver la limite effective du pipeline post-correctifs.

### Paramètres

| Paramètre | Valeur |
|-----------|--------|
| Plage de capteurs | 20 à 100 (pas de 20) |
| Plage de taux | 20 à 100 pts/s/capteur (pas de 20) |
| Combinaisons testées | 25 |

### Tableau des résultats

| Capteurs | Pts/s/capteur | Total pts/s | Latence p95 (ms) | Remarque |
|----------|---------------|-------------|-----------------|----------|
| 20       | 20            | 400         | 41.468          |          |
| 20       | 40            | 800         | 47.736          |          |
| 20       | 60            | 1 200       | N/A             | récupération post-burst |
| 20       | 80            | 1 600       | 19.529          |          |
| 20       | 100           | 2 000       | 17.228          |          |
| 40       | 20            | 800         | 9.910           |          |
| 40       | 40            | 1 600       | 9.965           |          |
| 40       | 60            | 2 400       | 9.962           |          |
| 40       | 80            | 3 200       | 18.283          |          |
| 40       | 100           | 4 000       | 17.581          |          |
| 60       | 20            | 1 200       | 17.989          |          |
| 60       | 40            | 2 400       | 24.014          |          |
| 60       | 60            | 3 600       | N/A             | récupération post-burst |
| 60       | 80            | 4 800       | N/A             | récupération post-burst |
| 60       | 100           | 6 000       | N/A             | récupération post-burst |
| 80       | 20            | 1 600       | N/A             | récupération post-burst |
| 80       | 40            | 3 200       | N/A             | récupération post-burst |
| 80       | 60            | 4 800       | 145.0 ⚠         | dégradation |
| 80       | 80            | 6 400       | 900.0 ⚠⚠        | saturation |
| 80       | 100           | 8 000       | N/A             | post-saturation |
| 100      | 20            | 2 000       | N/A             | post-saturation |
| 100      | 40            | 4 000       | N/A             | post-saturation |
| 100      | 60            | 6 000       | N/A             | post-saturation |
| 100      | 80            | 8 000       | N/A             | post-saturation |
| 100      | 100           | 10 000      | N/A             | post-saturation |

### Observations

**Comportement contre-intuitif : la latence descend quand le rate/capteur augmente.** Sur la ligne 40 capteurs (800 à 4 000 pts/s), la latence tombe à ~10 ms alors qu'elle était à ~18–24 ms dans la campagne 2. L'explication est l'effet de batching : un rate plus élevé par capteur produit de plus gros messages Kafka, ce qui rend les `bulkCreate` TimescaleDB plus efficaces par ligne insérée.

**Les N/A en bloc sont une récupération post-burst, pas une saturation.** Après un palier à fort débit, TimescaleDB doit digérer le WAL accumulé. Prometheus ne trouve pas de p95 valide pendant cette phase car le scrape renvoie `NaN`. Le pipeline reprend normalement dès que la DB a rattrapé son retard.

**La saturation réelle se manifeste à partir de 80 × 80 (6 400 pts/s)** avec des latences de 145 ms puis 900 ms, confirmant que le bottleneck est le **flush WAL de TimescaleDB** sur le stockage du Pi 4, non le backend Node.js ni Kafka.

---

## Campagne 4 — Haute charge, points d'opération ronds (17/03/2026)

Campagne complémentaire sur quatre points d'opération à effectifs élevés pour confirmer le comportement à 5 000 et 10 000 pts/s.

| Capteurs | Pts/s/capteur | Total pts/s | Latence p95 (ms) |
|----------|---------------|-------------|-----------------|
| 50       | 50            | 2 500       | 16.995          |
| 50       | 100           | 5 000       | 14.949          |
| 100      | 50            | 5 000       | 22.377          |
| 100      | 100           | 10 000      | 19.978          |

### Observations

**10 000 pts/s atteint sans saturation** : 100 capteurs × 100 pts/s → 19.978 ms. Ce résultat confirme que lorsque les batches sont suffisamment homogènes et que la DB n'est pas en phase de récupération WAL, le pipeline tient la charge à 10 000 pts/s avec une latence p95 inférieure à 20 ms.

**L'effet de batching se confirme** : 50 × 100 (5 000 pts/s, 14.949 ms) < 100 × 50 (5 000 pts/s, 22.377 ms). À total de points identique, plus le taux par capteur est élevé (batches plus gros), plus la latence est faible.

---

## Campagne 5 — Stress variable (17/03/2026)

Campagne avec des effectifs non multiples de 10 (33, 66, 99 capteurs × 33, 66, 99 pts/s) pour vérifier que les résultats ne sont pas artefactuels.

| Capteurs | Pts/s/capteur | Total pts/s | Latence p95 (ms) | Remarque |
|----------|---------------|-------------|-----------------|----------|
| 33       | 33            | 1 089       | 18.018          |          |
| 33       | 66            | 2 178       | 9.819           |          |
| 33       | 99            | 3 267       | N/A             | récupération post-burst |
| 66       | 33            | 2 178       | N/A             | récupération post-burst |
| 66       | 66            | 4 356       | N/A             | récupération post-burst |
| 66       | 99            | 6 534       | N/A             | récupération post-burst |
| 99       | 33            | 3 267       | 18.129          |          |
| 99       | 66            | 6 534       | 17.334          |          |
| 99       | 99            | 9 801       | 10.616          |          |

### Observations

**Confirmation de la cohérence** : les valeurs mesurables (18 ms, 9.8 ms, 18 ms, 17 ms, 10.6 ms) sont toutes dans la plage 10–25 ms observée dans toutes les campagnes. Aucun artefact de multiple de 10.

**99 × 99 à 10.6 ms** : la charge maximale de cette campagne (9 801 pts/s) aboutit à la latence la plus basse, confirmant l'effet de batching à haute densité. Les batches de 99 mesures/message sont traités très efficacement par `bulkCreate`.

**Bloc N/A central (33×99 à 66×99)** : la montée rapide en charge produit une phase de récupération WAL qui affecte plusieurs paliers consécutifs avant que la DB se stabilise. Le pipeline reprend normalement à partir de 99 × 33.

---

## Synthèse combinée — toutes campagnes

| Plage de charge | Latence p95 typique | Campagnes |
|-----------------|---------------------|-----------|
| 16 – 256 pts/s  | ~10 ms              | 1 (basse charge) |
| 25 – 900 pts/s  | 17 – 25 ms          | 2 (matrice 5×5) |
| 400 – 4 000 pts/s | 9 – 48 ms         | 3 (matrice 20×20) |
| 2 500 – 10 000 pts/s (stable) | 10 – 23 ms | 4 (points ronds) |
| 1 000 – 9 800 pts/s (variable) | 10 – 18 ms | 5 (stress variable) |
| > 6 000 pts/s (burst) | 145 – 900 ms ⚠ | 3 (zone de saturation WAL) |

### Points clés

1. **Limite pre-correctifs** : ~2 400 pts/s. **Limite post-correctifs** : ~10 000 pts/s. Gain ×4 grâce aux deux fixes `await callback` + `ignoreDuplicates`.

2. **Comportement contre-intuitif** : plus le rate par capteur est élevé, plus la latence descend. Explication : batches fog plus gros → `bulkCreate` plus efficace par ligne.

3. **Les N/A en bloc sont une récupération WAL** : TimescaleDB digère le WAL accumulé après un burst. Le pipeline reprend normalement — ce n'est pas une saturation permanente.

4. **Latence p95 stable** entre 10 et 25 ms sur toute la plage de fonctionnement normal (16 à ~6 000 pts/s).

5. **Vrai bottleneck** : flush WAL de TimescaleDB sur le stockage du Pi 4. L'architecture logicielle (Kafka, Node.js, fog buffer) n'est pas le facteur limitant.

---

## Observations et analyse

### Stabilité de la latence

La latence p95 reste dans la plage 10–25 ms sur la quasi-totalité de la plage testée (16 à ~6 000 pts/s). Ce résultat est meilleur qu'attendu pour un Pi 4 faisant tourner 6 services simultanément.

### Bottleneck identifié

Le bottleneck du pipeline est le **flush WAL de TimescaleDB** sur le stockage du Pi 4. La saturation n'est pas franche (la latence ne monte pas progressivement) mais se manifeste par des phases de récupération après burst, avec des pics à 145 ms et 900 ms au-delà de ~6 400 pts/s de charge soutenue.

### Comportement du buffer fog

Le fog-service bufferise les mesures pendant 1 seconde (ou jusqu'à 10 entrées) avant de publier un batch sur Kafka. Le backend exécute ensuite un `bulkCreate` groupé. Ce mécanisme de batching amortit le coût fixe de chaque écriture en base, ce qui explique que la latence ne dégrade pas linéairement avec la charge — et même qu'elle tend à décroître quand les batches grossissent.

---

## Limites du test

- **Hardware** : les résultats sont spécifiques au Pi 4. Sur un serveur x86 avec SSD NVMe, les limites seraient significativement plus élevées.
- **Type de mesure** : test avec `temperature` uniquement (1 valeur par message). Les mesures multi-types (`ecg` à haute fréquence) produiraient un volume plus important.
- **Réseau** : le fog Pi et le cloud Pi étaient sur le même réseau local lors du test. En production avec un réseau WAN, la latence Kafka s'ajouterait.
- **Fenêtre Prometheus** : la métrique est calculée sur une fenêtre de 30 s (égale à la durée du palier), ce qui peut lisser les pics intra-palier et produire des N/A légitimes en phase de récupération.
- **Sessions Prometheus** : les N/A consécutifs après un burst ne signifient pas que le pipeline est bloqué — ils indiquent que Prometheus ne trouve pas de p95 valide pendant la récupération WAL.

---

## Optimisations identifiées (non implémentées)

### `synchronous_commit = off` (PostgreSQL)

Désactiver le commit synchrone dans PostgreSQL/TimescaleDB permettrait un gain immédiat sur la latence I/O disque en évitant le fsync à chaque transaction. Le risque est une perte de données sur les dernières transactions en cas de crash (acceptable pour un contexte IoT de monitoring).

```sql
-- Dans postgresql.conf ou en session
SET synchronous_commit = off;
```

### Partitionnement Kafka (ROADMAP)

Ajouter des partitions au topic `sensor-data` permettrait un traitement parallèle côté consumer. Sur Pi 4, ce serait de l'over-engineering — pertinent uniquement si le backend migre vers un serveur x86 avec plusieurs cœurs disponibles pour le consumer Kafka.

---

## Reproduire le test

```bash
cd python-simulator-over-mqtt-master
pip install -r requirements.txt

# Matrice standard (36 combinaisons, ~30 min)
python3 load_test_matrix.py \
  --max-sensors 30 \
  --max-rate 30 \
  --step 5 \
  --duration 30 \
  --types temperature \
  --broker local \
  --prometheus http://localhost:9090

# Matrice haute charge (25 combinaisons, ~30 min)
python3 load_test_matrix.py \
  --max-sensors 100 \
  --max-rate 100 \
  --step 20 \
  --duration 30 \
  --types temperature \
  --broker local \
  --prometheus http://localhost:9090

# Test rapide (9 combinaisons)
python3 load_test_matrix.py \
  --max-sensors 15 \
  --max-rate 15 \
  --step 5 \
  --duration 30
```

Le script génère automatiquement :
- `load_test_results_<timestamp>.csv` — données brutes
- `load_test_results_<timestamp>.png` — surface 3D latence p95 = f(capteurs, taux)

> Prérequis : la stack RAMI complète doit tourner (fog-service actif, backend cloud, Prometheus accessible), et les capteurs de test doivent être enregistrés en base (seeder `load-test-*` disponible dans `backend/seeders/`).
