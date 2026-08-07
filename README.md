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

## Organisation du parc & contrôle d'accès

- **Zones hiérarchiques** (vue `/zones`) : arbre récursif *entreprise › bâtiment › étage › pièce*. Chaque capteur est rattaché à une zone-feuille.
- **Équipes** (vue `/teams`) : groupes d'utilisateurs.
- **Accès en cascade** : on accorde l'accès à une zone à un utilisateur **ou** une équipe → tous voient, en cascade, les capteurs de tout le sous-arbre. L'accès effectif = accès individuels (par capteur) ∪ accès par zones (perso + équipes). Détails dans [`docs/API.md`](./docs/API.md).

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

## Stack Docker

Le projet est entièrement conteneurisé et se déploie sur **deux hôtes** : le **cloud** (VM/LXC ou Raspberry Pi) et le **fog** (Raspberry Pi en bordure de réseau, proche des capteurs).

### Cloud — `docker-compose.yml` (racine)

| Service | Image | Port (hôte→conteneur) | Rôle |
|---------|-------|-----------------------|------|
| `node-db` | TimescaleDB / PostgreSQL 13 | `5432` | Base de données (hypertable `SensorData`) |
| `kafka` | `apache/kafka:3.9.0` (KRaft, sans Zookeeper) | `9092` | Bus de messages `sensor-data` |
| `node-backend` | `ghcr.io/umons-ig/iot-rami-backend` | `3000` | API REST + WebSocket + consumer Kafka |
| `frontend` | `ghcr.io/umons-ig/iot-rami-frontend` (Nginx) | `8080→80` | SPA Vue 3 |
| `prometheus` | `prom/prometheus` | `9090` | Scraping des métriques |
| `grafana` | `grafana/grafana` | `3001→3000` | Dashboards |
| `watchtower` | `nickfedor/watchtower` | — | Auto-déploiement (poll GHCR toutes les 300 s) — fork maintenu de Watchtower |

> ⚠️ **Mosquitto n'est PAS dans le compose racine** : le broker MQTT vit uniquement sur le fog (voir ci-dessous). Le cloud ne reçoit les données que via Kafka.

### Fog — `fog-service/compose.yaml` (Raspberry Pi)

| Service | Image | Port | Rôle |
|---------|-------|------|------|
| `mosquitto` | `eclipse-mosquitto:2.0.20` | `1883` | Broker MQTT local (capteurs ↔ fog) |
| `fog-service` | `ghcr.io/umons-ig/iot-rami-fog` | — | Bridge MQTT → Kafka + buffer |
| `fog-postgres` | `postgres:16-alpine` | — | Store-and-forward persistant (outbox) si le cloud est injoignable |
| `watchtower` | `nickfedor/watchtower:1.18.1` | — | Auto-déploiement de l'image fog (fork maintenu) |

### Volumes & persistance

- `db-data` (cloud) : données TimescaleDB — **ne jamais supprimer en prod** (`down -v` efface tout).
- `grafana-data` (cloud) : dashboards et config Grafana.
- L'outbox `fog-postgres` (fog) garantit qu'aucune mesure n'est perdue pendant une coupure réseau fog↔cloud : les messages sont rejoués à la reconnexion.

### Déploiement continu (Watchtower)

La CI pousse les images sur **GHCR** (publiques). Sur chaque hôte, **Watchtower** détecte les nouvelles images `latest` et redéploie automatiquement les conteneurs — aucun `git pull` ni rebuild manuel sur les serveurs. Voir [CI/CD](#cicd).

> 💡 **Rappel migrations** : Watchtower met à jour le **code**, pas le **schéma** de la base. Après un déploiement qui ajoute une colonne, lancer `npm run docker:migrate` (cf. encadré « Démarrage rapide ») — sinon le backend renvoie une **500** sur les requêtes touchant la nouvelle colonne.

---

## Comptes de test (seed)

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| `adriano@ig.umons.ac.be` | `adriano@ig.umons.ac.be` | Admin |

> ⚠️ **Développement uniquement.** Le hash bcrypt de ce compte est committé : son
> mot de passe est donc public. Depuis l'audit, le seeder **se saute en
> production** (avec un avertissement) sauf `ALLOW_DEMO_SEED=true`.
>
> Si ta base de production a été initialisée avec `init-db` **avant** ce
> correctif, le compte existe toujours : vérifie-le et supprime-le.
>
> ```sql
> SELECT id, email, role FROM "Users" WHERE email = 'adriano@ig.umons.ac.be';
> DELETE FROM "Users" WHERE email = 'adriano@ig.umons.ac.be';
> ```

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

Un audit complet a été mené le 2026-08-07 : **[`docs/AUDIT_SECURITE.md`](./docs/AUDIT_SECURITE.md)**
recense les failles corrigées, les arbitrages, les pièges à ne pas réintroduire et
ce qui reste ouvert. À lire avant toute reprise du projet.

**Trois chantiers restent ouverts** — aucun n'est un oubli, chacun demande une
opération d'infrastructure :

| Chantier | Pourquoi c'est ouvert | Prochain pas |
|---|---|---|
| **HTTPS absent** | Les services sont en HTTP clair (backend `:3000`, frontend `:8080`, Grafana `:3001`) : les JWT circulent en clair. Le blocage est le **nom de domaine**, sans lequel Let's Encrypt ne peut pas émettre. | Traefik ou Caddy en frontal, puis reprendre `VITE_APP_BACK_URL`, `VITE_SOCKET_URL` et `FRONTEND_URL`. |
| **Kafka en PLAINTEXT** (`:9092`) | Le port doit rester joignable par le fog **distant** ; le fermer coupe la collecte. Qui l'atteint lit tout le flux médical et peut injecter de fausses mesures. | **Tout de suite** : `ufw allow from <IP_FOG> to any port 9092 && ufw deny 9092`. Ensuite SASL_SSL — le code lit déjà `KAFKA_SSL` / `KAFKA_SASL_*` des deux côtés, et le compose a le bloc prêt en commentaire. |
| **MQTT sans TLS ni ACL** | Le TLS est **prêt** (firmware `universal_tls`, `mqtts://` côté fog) mais désactivé : la bascule doit être simultanée broker + fog + capteurs. Les ESP partagent une identité, donc l'un peut commander les autres. | Cf. [`docs/FIRMWARE_DEPLOYMENT.md`](./docs/FIRMWARE_DEPLOYMENT.md) §8. À faire **avant** de flasher le parc. |

Autres chantiers (rétention locale des données médicales, standardisation MQTT,
Home Assistant) : [`docs/ETAT_DES_LIEUX.md`](./docs/ETAT_DES_LIEUX.md).

## CI/CD

Pipeline GitHub Actions : lint → test → docker build → push vers GHCR → déploiement auto via Watchtower sur VM.
Images Docker : `ghcr.io/umons-ig/iot-rami-backend`, `ghcr.io/umons-ig/iot-rami-frontend`, `ghcr.io/umons-ig/iot-rami-fog`
