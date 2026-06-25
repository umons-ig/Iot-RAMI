# RAMI 1.0 — Système de gestion de capteurs IoT

Projet de l'Université de Mons (UMONS) — Capture, traitement et visualisation de données de capteurs IoT en temps réel (ECG, température, humidité).

---

## Architecture globale

```
ESP32 / Simulateur Python
        │
        │ MQTT ({topic}/sensor)
        ▼
  Fog-service (Raspberry Pi)
  Mosquitto local + fog-service Node.js
        │
        │ Kafka (topic: sensor-data)
        ▼
  Backend Cloud (Express :3000)  ──► TimescaleDB (PostgreSQL)
        │
        │ WebSocket (Socket.io)
        ▼
  Frontend Vue 3 (:8080)
```

**Flux de données :**
1. Le capteur publie ses mesures en MQTT sur le broker Mosquitto local du fog
2. Le fog-service bufferise et publie sur Kafka (batch toutes les 1s)
3. Le backend cloud consomme Kafka, stocke dans TimescaleDB
4. Le frontend reçoit les données en temps réel via WebSocket (Socket.io)

---

## Structure du dépôt

| Dossier | Description | Port |
|---------|-------------|------|
| `backend/` | API REST Express/TypeScript + Socket.io | 3000 |
| `frontend/` | SPA Vue 3 + Vite | 8080 |
| `fog-service/` | Bridge MQTT → Kafka (Raspberry Pi) | — |
| `python-simulator-over-mqtt-master/` | Simulateur de capteur MQTT (Python) | — |
| `Arduino/` | Sketches ESP32 (DHT22, ECG AD8232) | — |
| `docs/` | Documentation technique | — |
| `monitoring/` | Configuration Prometheus + dashboard Grafana | — |

---

## Démarrage rapide

> Les scripts `docker:*` lisent `NODE_ENV` pour choisir le fichier d'env
> (`.env.$NODE_ENV`) et le nom du projet Compose. Exporte-le d'abord :
> ```bash
> export NODE_ENV=development
> ```

### 1. Backend (API + base de données, tout en Docker)
```bash
cd backend
npm install
npm run docker:start        # Lance TimescaleDB, Kafka, le backend (:3000), le frontend, Prometheus et Grafana
npm run docker:init-db      # PREMIÈRE FOIS uniquement : migrations + seeders
```

Le backend tourne désormais dans le conteneur sur `:3000`. Inutile de lancer
`npm run dev` en plus (ce serait un second serveur, hors Docker).

> **Après un `git pull` qui ajoute/modifie une colonne** (nouveau champ de
> modèle Sequelize), applique les migrations **sans** recréer la base :
> ```bash
> npm run docker:migrate     # docker exec ... npm run migrate
> ```
> ⚠️ Ne fais **jamais** `docker compose down -v` pour corriger une 500 : `-v`
> **efface le volume de la base** (toutes les données). En dev c'est sans
> conséquence (les seeders rechargent tout), mais en **prod** tu perdrais les
> vraies mesures capteurs. La bonne réponse à une 500 au login du type
> `column "..." does not exist`, c'est `docker:migrate`.

### 2. Frontend
```bash
cd frontend
npm install
VITE_APP_ENV=dev npm run dev   # Démarre sur :8080
```

### 3. Simulateur Python (si pas d'ESP32 ni de fog)
```bash
cd python-simulator-over-mqtt-master
pip install -r requirements.txt
python3 ./mqttCliApp.py sensor local --topic pysimulator-esp32-ecg-topic --types temperature humidity --rate 1
```

### Commandes Docker utiles (backend)
| Commande | Effet |
|----------|-------|
| `npm run docker:start` | Démarre toute la stack (DB, Kafka, backend, frontend, Prometheus, Grafana) |
| `npm run docker:stop` | Arrête les conteneurs (conserve les données) |
| `npm run docker:migrate` | Applique les migrations en attente dans le conteneur |
| `npm run docker:init-db` | Migrations **+ seeders** (réinitialisation complète du schéma) |
| `npm run docker:exec` | Ouvre un shell dans le conteneur backend |

---

## Comptes de test (seed)

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| `adriano@ig.umons.ac.be` | `adriano@ig.umons.ac.be` | Admin |

---

## Documentation

- Documentation technique : [`docs/`](./docs/README.md)
- API Swagger : http://localhost:3000/api/v1/docs
- Monitoring (Prometheus/Grafana) : [`docs/MONITORING.md`](./docs/MONITORING.md)
- README Backend : [`backend/README.md`](./backend/README.md)
- README Frontend : [`frontend/README.md`](./frontend/README.md)
- README Fog : [`fog-service/README.md`](./fog-service/README.md)
- Simulateur Python : [`python-simulator-over-mqtt-master/README.md`](./python-simulator-over-mqtt-master/README.md)
- Sketches Arduino/ESP32 : [`Arduino/ESP32/README.md`](./Arduino/ESP32/README.md) (DHT22, AD8232, BME280, HC-SR04, MR60BHA2)

---

## Sécurité & déploiement (état actuel)

> **HTTPS / Reverse proxy : non encore en place.** Tant que le projet n'est pas en
> production, les services sont exposés en **HTTP clair** (backend `:3000`, frontend `:8080`,
> Grafana `:3001`). Avant toute mise en production, prévoir un **reverse proxy TLS**
> (Traefik ou Caddy) en frontal pour terminer le HTTPS (Let's Encrypt), n'exposer qu'un seul
> port 443, et fermer les ports applicatifs et Kafka de l'accès direct.
>
> De même, le transport **fog → Kafka** est aujourd'hui en `PLAINTEXT` sans authentification.
> Voir [`docs/ETAT_DES_LIEUX.md`](./docs/ETAT_DES_LIEUX.md) pour les pistes de sécurisation
> (WireGuard, SASL_SSL) et les autres chantiers (rétention locale des données médicales,
> standardisation MQTT, intégration Home Assistant).

## CI/CD

Pipeline GitHub Actions : lint → test → docker build → push vers GHCR → déploiement auto via Watchtower sur VM.
Images Docker : `ghcr.io/gaspardmenou/iot-rami-backend`, `ghcr.io/gaspardmenou/iot-rami-frontend`, `ghcr.io/gaspardmenou/iot-rami-fog`
