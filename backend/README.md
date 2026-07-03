# UMONS — Sensor Backend

API REST Express/TypeScript pour la gestion des capteurs IoT du projet RAMI 1.0 (Université de Mons).

---

## Stack technique

| Technologie | Rôle |
|-------------|------|
| Node.js + Express + TypeScript | Serveur HTTP REST |
| TimescaleDB (PostgreSQL 13) | Stockage des données capteurs (hypertable) |
| Sequelize | ORM + migrations |
| Kafka (`apache/kafka:3.9.0`, mode KRaft) | Pipeline de données temps réel |
| MQTT (Mosquitto local, via fog-service) | Réception des données des capteurs |
| Socket.io | WebSocket pour le frontend temps réel |
| JWT + bcrypt | Authentification |
| Jest | Tests unitaires |
| Swagger | Documentation API |

---

## Prérequis

- Node.js LTS (≥ 18)
- Docker + Docker Compose
- npm

---

## Installation

```bash
npm install
```

Créer un fichier `.env.development` à la racine du projet :

```bash
DB_CONTAINER_NAME=umons-sensor-db-dev
DB_VERSION=13
DB_PORT_OUT=5432
DB_PORT_IN=5432
DB_USER=umons-sensor-dev
DB_PASSWORD=change_me
DB_NAME=umons-sensor-db-dev

NODE_ENV=development
NODE_PORT=3000
NODE_PORT_IN=3000
NODE_PORT_OUT=3000
NODE_CONTAINER_NAME=umons-sensor-dev

JWT_SECRET=change-me-in-production
JWT_EXPIRATION=1d
BCRYPT_SALT_ROUNDS=10

DB_DIALECT=postgres
KAFKA_BROKERS=kafka:9092
```

---

## Démarrage

### 1. Lancer l'infrastructure Docker

```bash
npm run docker:build    # Build l'image (nécessite NODE_ENV défini)
npm run docker:start    # Lance TimescaleDB, Kafka (KRaft), Prometheus, Grafana et le backend
```

Services Docker démarrés (compose de dev local — `backend/docker-compose.yml`) :
- `node-backend` — API Express sur le port 3000
- `node-db` — TimescaleDB (PostgreSQL 13) sur le port 5432
- `kafka` — `apache/kafka:3.9.0` en mode **KRaft** (sans Zookeeper) sur le port 9092
- `prometheus` / `grafana` — Monitoring sur les ports 9090 / 3001

> **Mosquitto n'est PAS inclus dans ce compose de dev** : le broker MQTT tourne sur le
> Raspberry Pi fog (`fog-service/compose.yaml`). Pour un test local avec le simulateur
> Python sans fog, lancez un broker MQTT (Mosquitto local ou conteneur) et pointez le
> simulateur dessus via son argument de broker.
>
> Le compose de production (`docker-compose.yml` racine) reprend cette même configuration
> Kafka KRaft et ajoute en plus les services `mosquitto`, `frontend` et `watchtower`.

### 2. Initialiser la base de données (première fois)

```bash
npm run docker:init-db   # Migrations + seeders
# ou séparément :
npm run migrate
npm run seed
```

### 3. Démarrer le serveur en développement

```bash
npm run dev   # Nodemon sur :3000
```

---

## Commandes utiles

```bash
npm run dev              # Serveur de développement (nodemon)
npm run test             # Tests Jest (--runInBand)
npm run test:coverage    # Tests avec rapport de couverture
npm run format           # ESLint --fix
npm run docker:start     # docker compose up -d
npm run docker:init-db   # Migrations + seeders
```

---

## Architecture

### Routes API (`/api/v1`)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/users/login` | Connexion utilisateur (JWT + cookie refresh) |
| GET/POST | `/sensors` | Lister / créer un capteur |
| GET | `/sensors/discovered` | Capteurs détectés automatiquement via MQTT |
| GET | `/sensors/connexion/online/:name` | Statut en ligne d'un capteur |
| GET | `/sessions` | Sessions de mesure |
| GET | `/sessions/:id/export/csv` | Export CSV d'une session |
| GET | `/measurements` | Mesures |
| GET | `/measurementTypes` | Types de mesures |
| GET/POST | `/zones` | Zones hiérarchiques (arbre via `/zones/tree`) |
| POST/DELETE | `/zones/:id/access` | Accorder/retirer l'accès à une zone (user ou team, cascade) |
| GET/POST | `/teams` | Équipes d'utilisateurs (+ `/teams/:id/members`) |
| GET/POST | `/thresholds` | Seuils d'alerte par capteur |

Documentation complète : http://localhost:3000/api/v1/docs

### Services

- **`mqttServer.ts`** — Client MQTT singleton. Gère la connexion au broker local, les PINGs (auto-discover + statut capteur). Ne publie plus sur Kafka (rôle du fog-service).
- **`kafkaService.ts`** — Consommateur Kafka uniquement. Reçoit les messages du fog-service, stocke dans TimescaleDB et déclenche la diffusion WebSocket.
- **`socketService.ts`** — Socket.io attaché au serveur HTTP. Rooms par topic MQTT, diffuse les nouvelles données et le statut des capteurs au frontend.

### Format des messages Kafka reçus (depuis le fog-service)

```json
{ "type": "start", "sensorTopic": "esp32-dht22-topic/sensor", "timestamp": 1735000000000 }
{ "type": "data",  "sensorTopic": "esp32-dht22-topic/sensor", "measures": [{ "timestamp": 1735000001000, "measures": [{ "measureType": "temperature", "value": 22.5 }] }] }
{ "type": "stop",  "sensorTopic": "esp32-dht22-topic/sensor", "timestamp": 1735000060000 }
```

Voir [`docs/KAFKA.md`](../docs/KAFKA.md) et [`docs/MQTT.md`](../docs/MQTT.md) pour la documentation complète.

---

## Tests

```bash
npm run test             # Tous les tests
npm run test:coverage    # Avec couverture (rapport dans /coverage)
```

Compte de test (seed) : `adriano@ig.umons.ac.be` / `adriano@ig.umons.ac.be`

---

## CI/CD

Pipeline GitHub Actions (`.github/workflows/backend-ci.yml`) :
1. **lint** — ESLint
2. **test** — Jest
3. **docker-push** — Build + push vers `ghcr.io/umons-ig/iot-rami-backend` (sur push vers `main` uniquement)

Déploiement automatique via Watchtower sur la VM de production.
