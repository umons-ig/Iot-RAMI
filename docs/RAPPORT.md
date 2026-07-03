# Rapport de contribution — Stage RAMI 1.0

**Etudiant** : Gaspard
**Institution** : Universite de Mons (UMONS)
**Periode** : Fevrier – Mars 2026
**Projet** : RAMI 1.0 — Systeme de gestion de capteurs IoT

---

## Contexte

RAMI 1.0 est un systeme de capture, traitement et visualisation de donnees capteurs IoT en temps reel, developpe a l'Universite de Mons. Le projet couvre l'ensemble de la chaine : hardware ESP32 → protocole MQTT → traitement fog → pipeline Kafka → base de donnees TimescaleDB → visualisation frontend Vue 3.

Le code existant au debut du stage comportait plusieurs dysfonctionnements critiques et des limitations architecturales importantes.

---

## Travail realise

### Phase 1 — Stabilisation et corrections critiques

- **Correction KafkaService** : le consumer Kafka n'etait pas initialise, causant des crashes au demarrage. Ajout de `this.consumer = this.kafka.consumer(...)` dans `connectToKafka()`.
- **Externalisation des configurations hardcodees** : `KAFKA_BROKERS`, `MQTT_URL`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD` passes en variables d'environnement.
- **Gestion d'erreurs MQTT** : implementation de `handleErrorMqtt` avec logging structure et backoff exponentiel pour la reconnexion.
- **Resilience Kafka** : health check au demarrage, le serveur demarre en mode degrade si Kafka est indisponible.
- **Verification du flux complet** : simulateur Python → Mosquitto → backend → DB → frontend → graphique ECG.

### Phase 2 — Pipeline temps reel via WebSocket

Remplacement de la connexion MQTT directe navigateur → broker (qui exposait les credentials MQTT au client) par une architecture WebSocket securisee.

- **Backend** : creation de `socketService.ts` — serveur Socket.io attache au serveur HTTP, authentification JWT sur `join-session`, rooms par topic, consommation Kafka et rediffusion.
- **Frontend** : remplacement de `connectToMQTT` par `connectToWebSocket` dans `useSession.composable.ts`.
- **Securite** : les credentials MQTT ne sont plus retournes au frontend.

### Phase 3 — Amelioration du frontend

- **Validation des formulaires** : regles de complexite du mot de passe (12 caracteres, majuscule, chiffre, special), messages d'erreur clairs.
- **Indicateur de statut capteur** : badge online/offline en temps reel via WebSocket et timeout 30s.
- **Panel admin** : CRUD capteurs, gestion des roles, vue des sessions actives.
- **Export CSV** : route `GET /sessions/:id/export/csv`, bouton dans l'interface, protection contre l'injection CSV.
- **Responsive design** : adaptation mobile et tablette.

### Phase 3 — Auto-decouverte et multi-mesures

- **Auto-decouverte** : le fog ecoute le wildcard MQTT `#` et maintient une liste des topics inconnus (`discoveredTopics`). Route `GET /sensors/discovered`.
- **Multi-mesures** : format de message etendu `{ timestamp, measures: [{ measureType, value }] }`, cle primaire composite `time + idSensor + idMeasurementType` dans `sensordata`, cache `measurementTypesMap`.
- **Simulateur Python** : ajout du support multi-types avec arguments CLI (`--types`, `--rate`, `--topic`).
- **Frontend** : datasets dynamiques par `measureType` dans `useSession.composable.ts`.

### Phase 4 — Integration hardware ESP32

- **Sketch DHT22** (`sensor_dummy_mqtt/`) : temperature + humidite, format multi-mesures, PING periodique, portail captif WiFiManager.
- **Sketch ECG AD8232** : mise a jour vers le nouveau format + structure modulaire.
- **Structure modulaire** : separation `Sensor.hpp/cpp` (specifique au capteur) / `MQTTCommonOperations` (generique) / `BASE.ino` (orchestration). Pour changer de capteur, seul `Sensor.hpp/cpp` est a reecrire.
- **Portail captif** : configuration WiFi, MQTT host/port/credentials, nom du capteur via interface web embarquee.

### Phase 4 — Architecture Fog/Cloud

- **Fog-service** : service Node.js dedie sur Raspberry Pi. Recoit les messages MQTT, bufferise les donnees (flush toutes les 1s ou apres 10 entrees), publie sur Kafka en batch.
- **Protocole fog** : PING → START → ACK → mesures → STOP. Timeout 30s sur le fog declenche automatiquement un STOP Kafka.
- **Cloud consumer-only** : le backend cloud ne publie plus sur Kafka, il consomme uniquement.
- **Sessions fog-driven** : le fog cree et clot les sessions via Kafka, le frontend n'a plus de bouton start/stop.
- **Auto-join session active** : le frontend detecte et rejoint automatiquement une session active au montage du composant.

### Phase 4 — Deploiement

- **VM cloud** : docker-compose avec backend, TimescaleDB, Kafka (KRaft, sans Zookeeper), Frontend, Prometheus, Grafana. Watchtower pour le deploiement automatique.
- **Raspberry Pi fog** : docker-compose avec Mosquitto authentifie, fog-service, Watchtower. Script `install.sh` automatise.
- **CI/CD GitHub Actions** : pipeline lint → test → docker build → push GHCR → Watchtower (redemarrage automatique).
- **Multi-platform build** : images `linux/amd64` + `linux/arm64` (QEMU + buildx).
- **mDNS** : le Pi s'annonce en `rami-fog.local` via Avahi.

### Phase 5 — Tests et qualite

- **Backend** : 348 tests Jest — controllers, middlewares, services (MQTT mock, Kafka mock, Socket.io mock).
- **Frontend** : 137 tests Vitest — composables (`useSession`, `useSensor`, `useUser`, `useChart`, ...), stores Pinia, helpers.
- **Fix CI** : polyfill `SlowBuffer` pour `buffer-equal-constant-time`, mock manuel MQTT, mock Socket.io.
- **Test de charge** : campagne via `load_test_matrix.py`, 100 capteurs, paliers 100–1 000 pts/s/capteur. Latence p95 mesuree via `kafka_message_processing_seconds` Prometheus.
  - Raspberry Pi 4 (prod) : limite ~2 400 pts/s (bottleneck I/O disque TimescaleDB sur SD).
  - LXC Proxmox SSD (Ryzen 5 4650 Pro) : plafond utile ~60 000 pts/s (~5 ms p95 a 10 000 pts/s, ~219 ms a 60 000 pts/s).
  - Au-dela : le fog droppe les messages (`MAX_BUFFER_SIZE=500`), la latence Kafka baisse artificiellement.

### Optimisations appliquees suite aux tests de charge

- **fog-service** : suppression des `console.log` de debug dans le handler MQTT, limite dure du buffer (`MAX_BUFFER_SIZE=500` par topic, configurable), flush parallele via `Promise.all`.
- **backend** : pool Sequelize `max: 20` connexions (au lieu de 5 par defaut).

### Phase 6 — Documentation

- **READMEs** mis a jour : racine, backend, frontend, sensors-over-mqtt-master, python-simulator.
- **docs/MQTT.md** : protocole complet, topics, formats de messages, flux.
- **docs/KAFKA.md** : topic `sensor-data`, schemas des 3 types de messages, flux de traitement backend.
- **docs/API.md** : reference complete de l'API REST et du WebSocket Socket.io.
- **docs/DEMO.md** : scenario de demonstration pas a pas.
- **Swagger** : corrections et ajout des routes manquantes.

---

## Bilan technique

| Metrique                    | Valeur                                            |
|-----------------------------|---------------------------------------------------|
| Tests backend               | 348 (Jest)                                        |
| Tests frontend              | 137 (Vitest)                                      |
| Routes API                  | ~35 endpoints REST                                |
| Topics Kafka                | 1 (`sensor-data`)                                 |
| Types de mesures            | 3 (`ecg`, `temperature`, `humidity`)              |
| Services Docker (prod)      | 7 (backend, frontend, DB, Kafka, Prometheus, Grafana, Watchtower) |
| Platforms supportees        | `linux/amd64`, `linux/arm64`                      |
| Debit prod (Pi 4, SD)       | ~2 400 pts/s                                      |
| Debit Proxmox SSD (plafond) | ~60 000 pts/s                                     |
| Buffer max fog par topic    | 500 messages (configurable via `MAX_BUFFER_SIZE`)  |

---

## Architecture finale

```
ESP32 / Simulateur Python
    |
    | MQTT ({topic}/sensor)
    v
Fog-service (Raspberry Pi)
  - Mosquitto broker (local, authentifie)
  - fog-service Node.js
    - Ecoute MQTT wildcard #
    - Bufferise les mesures
    - Publie sur Kafka en batch
    |
    | Kafka (sensor-data : start / data / stop)
    v
Backend Cloud (VM x86, port 3000)
  - Express + TypeScript
  - KafkaService (consumer)
  - SocketService (Socket.io)
    |----> PostgreSQL / TimescaleDB (sessions, sensordata)
    |----> WebSocket (Socket.io) -------> Frontend Vue 3 (port 8080)
                                            - Graphique temps reel (Chart.js)
                                            - Panel admin
                                            - Export CSV
```

---

## Points d'amelioration identifies (hors scope stage)

- ~~Nettoyage des `console.log` de debug~~ — realise (handler MQTT fog-service)
- Securisation des routes (certaines routes ne sont pas encore protegees par le middleware `auth`)
- Tests d'integration end-to-end (simulateur → DB → frontend)
- ~~Benchmarks de latence et debit~~ — realise le 17/03/2026 (voir [LOAD_TEST.md](./LOAD_TEST.md))
- Support TLS pour le broker Mosquitto du fog (actuellement en clair sur le reseau local)
- `synchronous_commit = off` dans PostgreSQL pour gagner en debit sur le Pi (optimisation possible, non appliquee)
