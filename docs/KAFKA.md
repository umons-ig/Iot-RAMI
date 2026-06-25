# Kafka — Topic et schemas de messages

## Configuration

| Parametre         | Variable d'environnement | Valeur par defaut |
|-------------------|--------------------------|-------------------|
| Broker            | `KAFKA_BROKERS`          | `localhost:9092`  |
| Client Fog        | `clientId`               | `fog-service`     |
| Client Backend    | `clientId`               | `sensor-app`      |
| Group consommateur| `groupId`                | `sensor-group`    |

---

## Topic unique : `sensor-data`

Tout le flux de donnees capteur transite par un seul topic Kafka : **`sensor-data`**.

Le fog-service est **producteur** (publie les messages).
Le backend cloud est **consommateur** (recoit et traite les messages).

---

## Schemas de messages

Chaque message est serialise en JSON. Trois types existent, discrimines par le champ `type`.

### Type `start` — Debut de session

Publie par le fog quand le capteur envoie la commande `start`.
Le backend cree une nouvelle session en base de donnees.

```json
{
  "type": "start",
  "sensorTopic": "esp32-dht22-topic/sensor",
  "timestamp": 1735000000000
}
```

| Champ         | Type     | Description                                      |
|---------------|----------|--------------------------------------------------|
| `type`        | `string` | Toujours `"start"`                               |
| `sensorTopic` | `string` | Topic MQTT complet du capteur (avec `/sensor`)   |
| `timestamp`   | `number` | Epoch Unix en millisecondes                      |

---

### Type `data` — Donnees de mesure

Publie par le fog a intervalles reguliers (flush toutes les `FLUSH_INTERVAL_MS` = **200 ms** par defaut, ou des que le buffer atteint `FLUSH_MAX_SIZE` = **50 entrees**).
Le backend stocke les donnees en base (TimescaleDB) et les envoie aux clients WebSocket connectes.

```json
{
  "type": "data",
  "sensorTopic": "esp32-dht22-topic/sensor",
  "measures": [
    {
      "timestamp": 1735000001000,
      "measures": [
        { "measureType": "temperature", "value": 23.5 },
        { "measureType": "humidity",    "value": 61.2 }
      ]
    },
    {
      "timestamp": 1735000002000,
      "measures": [
        { "measureType": "temperature", "value": 23.7 },
        { "measureType": "humidity",    "value": 60.8 }
      ]
    }
  ]
}
```

| Champ                       | Type       | Description                                      |
|-----------------------------|------------|--------------------------------------------------|
| `type`                      | `string`   | Toujours `"data"`                                |
| `sensorTopic`               | `string`   | Topic MQTT complet du capteur                    |
| `measures`                  | `array`    | Tableau d'entrees de mesure (batch)              |
| `measures[].timestamp`      | `number`   | Epoch Unix en millisecondes                      |
| `measures[].measures`       | `array`    | Tableau de paires type/valeur                    |
| `measures[].measures[].measureType` | `string` | Nom du type de mesure (`ecg`, `temperature`, `humidity`) |
| `measures[].measures[].value`       | `number` | Valeur numerique de la mesure               |

---

### Type `stop` — Fin de session

Publie par le fog quand le capteur envoie la commande `stop` ou quand le timeout de 30 secondes expire (plus de ping).
Le backend cloture la session en base (`endedAt` mis a jour).

```json
{
  "type": "stop",
  "sensorTopic": "esp32-dht22-topic/sensor",
  "timestamp": 1735000060000
}
```

| Champ         | Type     | Description                                      |
|---------------|----------|--------------------------------------------------|
| `type`        | `string` | Toujours `"stop"`                                |
| `sensorTopic` | `string` | Topic MQTT complet du capteur (avec `/sensor`)   |
| `timestamp`   | `number` | Epoch Unix en millisecondes                      |

---

## Flux de traitement cote backend

```
Kafka topic "sensor-data"
        |
        v
  KafkaService.startConsuming()
        |
        +-- type "start" --> handleSessionStart()
        |     - Recherche du capteur en DB (par baseTopic)
        |     - Cree Session { idSensor, idFog: "fog-service", createdAt }
        |     - Enregistre sensorTopic → sessionId dans activeSessions
        |
        +-- type "data"  --> handleSensorData()
        |     - Recupere sessionId depuis activeSessions
        |     - Cree SensorData { time, idSensor, idMeasurementType, value }
        |     - Diffuse via WebSocket (sendDataToRoom)
        |
        +-- type "stop"  --> handleSessionStop()
              - Recupere sessionId depuis activeSessions
              - Met a jour Session { endedAt }
              - Supprime sensorTopic de activeSessions
```

---

## Strategie de retry (backend)

Si Kafka est indisponible au demarrage, le backend retente avec un backoff exponentiel :

- Max retries : 10
- Delai initial : 1 seconde
- Delai max : 30 secondes
- Formule : `min(2^n * 1000ms, 30000ms)`

Apres 10 echecs, le backend demarre sans Kafka (mode degrade).

---

## Buffer fog-service

Le fog-service accumule les mesures en memoire avant de les envoyer a Kafka en batch.

### Parametres de configuration (variables d'environnement)

| Variable            | Defaut | Description                                                        |
|---------------------|--------|--------------------------------------------------------------------|
| `FLUSH_INTERVAL_MS` | `200`  | Intervalle de flush periodique en millisecondes                    |
| `FLUSH_MAX_SIZE`    | `50`   | Nombre d'entrees declenchant un flush immediat                     |
| `MAX_BUFFER_SIZE`   | `500`  | Limite dure du buffer par topic — les messages en surplus sont droppes |

### Comportement a saturation

Quand le buffer d'un topic atteint `MAX_BUFFER_SIZE` messages :

1. Le message entrant est **ignore** (drop silencieux apres un premier avertissement log)
2. Un avertissement est emis une seule fois par topic jusqu'au prochain flush
3. Apres le flush, `dropWarnedTopics` est reinitialise — les avertissements reprennent si le buffer se resature

Ce mecanisme protege le fog contre les OOM lors de pics de charge.

### Flush parallele

Le flush periodique (`setInterval`) utilise `Promise.all` pour vider tous les topics en parallele plutot que sequentiellement, ce qui reduit la latence de publication lors de pics multi-capteurs.

---

## Performances messurees

### Sur Raspberry Pi 4 8 GB (hardware de production actuel, TimescaleDB sur carte SD)

| Metrique          | Valeur                                          |
|-------------------|-------------------------------------------------|
| Debit maximal     | ~2 400 pts/s                                    |
| Bottleneck        | I/O disque (TimescaleDB sur carte SD)           |
| Au-dela du seuil  | Timeout Kafka producer, accumulation buffer fog |

Au-dela de ~2 400 pts/s, le fog accumule des messages dans son buffer et finit par dropper les surplus si `MAX_BUFFER_SIZE` est atteint.

### Sur LXC Proxmox (Ryzen 5 4650 Pro, SSD NVMe, 8 coeurs, 12 GB RAM)

Tests realises avec 100 capteurs simultanees, paliers de 100 a 1 000 pts/s/capteur.
Metrique : latence `kafka_message_processing_seconds` p95 (Prometheus).

| Debit total  | Latence p95 | Remarque                                      |
|--------------|-------------|-----------------------------------------------|
| 10 000 pts/s | ~5 ms       | Regime nominal                                |
| 20 000 pts/s | ~46 ms      | Charge moderee                                |
| 30 000 pts/s | ~210 ms     | Debut de saturation DB                        |
| 40 000 pts/s | ~223 ms     | Saturation stable                             |
| 50 000 pts/s | ~218 ms     | Saturation stable                             |
| 60 000 pts/s | ~219 ms     | Plafond utile (~x25 vs Pi)                    |
| 70 000 pts/s | ~95 ms      | Debut de saturation fog buffer                |
| 80 000+ pts/s| ~5 ms       | Non representatif — fog droppe les messages   |

**Plafond utile : ~60 000 pts/s** sur cette configuration. Au-dela, le fog-service atteint sa limite de buffer (`MAX_BUFFER_SIZE`) et commence a dropper les messages avant qu'ils n'atteignent Kafka, ce qui fait artificiellement baisser la latence mesuree.

---

## Optimisations backend

### Pool de connexions Sequelize

Le pool de connexions PostgreSQL est configure a `max: 20` (valeur par defaut Sequelize : 5). Ce reglage est necessaire pour absorber les rafales de messages Kafka sans bloquer sur l'acquisition d'une connexion DB.

### Commandes de seed sans donnees de test de charge

Apres les tests de charge, la base contient jusqu'a 101 capteurs fictifs (`load-test-0` a `load-test-100`). Pour reinitialiser la base sans ces capteurs :

```bash
# Dans backend/
npm run seed:no-load-test       # Seed uniquement user + measurement types
npm run init-db:no-load-test    # Reset + migrate + seed sans capteurs load-test
```
