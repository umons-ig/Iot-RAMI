# Scenario de demonstration — RAMI 1.0

Ce document decrit la procedure complete pour realiser une demonstration du systeme de bout en bout.

## Prerequis

- Docker et Docker Compose installes sur la machine cloud
- Node.js LTS >= 18 (pour le frontend en dev local)
- Python 3 + `pip` (pour le simulateur)
- Acces aux fichiers `.env` configures (voir `.env.example`)

---

## Etape 1 — Lancer la stack cloud (backend + DB + Kafka)

```bash
cd backend
cp .env.example .env.development   # adapter les variables si necessaire
npm run docker:start               # lance node-backend, TimescaleDB, Kafka (KRaft), Frontend, Prometheus, Grafana
npm run docker:init-db             # migrations + seeds (premiere fois uniquement)
```

Verifier que les services sont up :

```bash
docker compose ps
```

Le backend est accessible sur : `http://localhost:3000/api/v1`
Swagger UI : `http://localhost:3000/api/v1/docs`

---

## Etape 2 — Lancer le frontend

```bash
cd frontend
VITE_APP_ENV=dev npm run dev
```

Le frontend est accessible sur : `http://localhost:8080`

---

## Etape 3 — Connexion

1. Ouvrir `http://localhost:8080`
2. Se connecter avec les identifiants de demonstration :
   - Email : `adriano@ig.umons.ac.be`
   - Mot de passe : `adriano@ig.umons.ac.be`

---

## Etape 4 — Lancer le simulateur Python

```bash
cd python-simulator-over-mqtt-master
pip install -r requirements.txt

# Lancer le simulateur sur le broker local, avec temperature et humidite
python3 ./mqttCliApp.py sensor local --topic pysimulator-esp32-ecg-topic --types temperature humidity --rate 1
```

Le simulateur va :
1. Envoyer un PING toutes les 20 secondes
2. Envoyer un START pour demander l'autorisation
3. Recevoir un ACK du fog-service
4. Publier des mesures de temperature et humidite chaque seconde

> Si un fog-service est utilise : lancer le fog avant le simulateur (voir ci-dessous).

---

## Etape 5 — Observer la session en temps reel

1. Dans le frontend, naviguer vers le capteur `pysimulator-esp32-ecg-topic`
2. Cliquer sur **Voir la session actuelle** (apparait automatiquement quand une session est active)
3. Le graphique affiche les courbes en temps reel via WebSocket
4. Verifier le statut du capteur en haut de la page (badge "en ligne")

---

## Etape 6 — Arreter la session

Appuyer sur **Ctrl+C** dans le terminal du simulateur. Le simulateur envoie un message `stop`, le fog flush les donnees restantes et publie un message Kafka `stop`. Le backend cloture la session automatiquement.

---

## Etape 7 — Exporter les donnees

1. Dans le frontend, aller sur la session terminee
2. Cliquer sur **Telecharger CSV**
3. Le fichier contient toutes les mesures avec horodatage et type

Ou directement via l'API :

```bash
curl http://localhost:3000/api/v1/sessions/<session-id>/export/csv -o session.csv
```

---

## Optionnel — Avec le fog-service (architecture complete)

Si le fog-service est deploye (ex. sur Raspberry Pi) :

```bash
# Sur le Raspberry Pi
cd fog-service
docker compose up -d
```

Le simulateur ou l'ESP32 se connecte au Mosquitto du fog. Le fog transmet vers Kafka sur le cloud.

---

## Optionnel — Avec un ESP32 reel

1. Flasher le sketch correspondant au capteur (`sensor_dummy_mqtt/` ou `AD8232_ecg/`)
2. Au premier demarrage, un portail captif WiFi s'ouvre (SSID : `RAMI-Config`)
3. Configurer le WiFi, l'adresse MQTT du fog, le nom du capteur
4. L'ESP32 demarre et publie automatiquement

---

## Zones et equipes (controle d'acces)

1. Vue **Zones** (`/zones`) : creer une zone racine « Batiment A », puis une sous-zone « Etage 2 » (bouton `+` sur la zone). L'arbre se construit a gauche.
2. Selectionner une zone → le panneau de droite montre ses **stats** (capteurs ici / sous-arbre / sous-zones) et permet de **rattacher un capteur**.
3. Vue **Equipes** (`/teams`, admin) : creer « Equipe Labo », lui ajouter des membres.
4. Retour dans **Zones** → selectionner « Batiment A » → panneau **ACCES** → accorder l'acces a l'equipe « Equipe Labo ». Tous ses membres voient desormais, **en cascade**, les capteurs de tout le batiment.

---

## Points a montrer lors de la demo

| Fonctionnalite                  | Ou le voir                                       |
|---------------------------------|--------------------------------------------------|
| Authentification JWT            | Page de connexion → token dans localStorage      |
| Gestion des capteurs (CRUD)     | Panel admin → Capteurs                           |
| Statut temps reel du capteur    | Badge "en ligne / hors ligne" sur la carte capteur |
| Graphique multi-mesures         | Vue session → courbes temperature + humidite     |
| Auto-decouverte de topics       | `GET /api/v1/sensors/discovered`                 |
| Export CSV                      | Bouton dans la carte session                     |
| Zones hierarchiques + drill-down | Vue `/zones` (arbre, stats, fil d'Ariane)       |
| Equipes + acces en cascade      | Vue `/teams` + panneau ACCES d'une zone          |
| Recherche de capteurs           | Barre de recherche dans `/sensors`               |
| Command palette                 | `⌘K` (navigation + theme + CRT)                  |
| Swagger API                     | `http://localhost:3000/api/v1/docs`              |
| Pipeline CI/CD                  | GitHub Actions → GHCR → Watchtower               |
