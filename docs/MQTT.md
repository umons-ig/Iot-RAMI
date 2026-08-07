# MQTT — Topics et protocole de messagerie

## Broker

| Parametre         | Variable d'environnement | Valeur par defaut       |
|-------------------|--------------------------|-------------------------|
| URL               | `MQTT_URL`               | `mqtt://localhost`      |
| Port              | `MQTT_PORT`              | `1883`                  |
| Utilisateur       | `MQTT_USERNAME`          | *(vide)*                |
| Mot de passe      | `MQTT_PASSWORD`          | *(vide)*                |

Le fog-service se connecte au broker Mosquitto local. Les capteurs ESP32 ou le simulateur Python se connectent au meme broker.

### Transport et authentification

Le broker exige une authentification (`allow_anonymous false` + `password_file`),
mais le transport est **en clair par défaut** : mesures et identifiants circulent
en clair sur le LAN.

Le TLS est **disponible et prêt à activer**, il faut basculer les trois côtés
ensemble :

| Côté | Bascule |
|---|---|
| Fog | `MQTT_URL=mqtts://<hote>` + `MQTT_PORT=8883` — `mqtt.js` gère le schéma seul, aucun code à changer |
| ESP32 | flasher l'environnement `universal_tls` (`-D RAMI_MQTT_TLS`), après avoir renseigné `Arduino/ESP32/Common/src/MqttCaCert.hpp` |
| Broker | listener `8883` avec les certificats dans `fog-service/mosquitto/config/mosquitto.conf` |

> ⚠️ Le jour où le broker n'écoute plus qu'en 8883, un fog resté en `mqtt://` ne
> collecte plus rien. La bascule est une opération coordonnée, pas un réglage.

**Limite connue : pas d'ACL par topic.** Tous les capteurs partagent une seule
identité MQTT. Un capteur compromis peut donc publier sur le topic `/server`
d'un autre et lui envoyer une commande `ota`, `set_mqtt` ou `restart` — c'est-à-dire
prendre le contrôle du parc. Y remédier suppose **un compte Mosquitto par
capteur** plus un `acl_file` : à décider avant de déployer les appareils, car
après cela demande de repasser sur chacun. Détail :
[AUDIT_SECURITE.md](AUDIT_SECURITE.md).

---

## Structure des topics

Chaque capteur est identifie par un **topic de base** (ex. `esp32-dht22-topic`). Deux sous-topics derives de cette base sont utilises :

| Sous-topic         | Suffixe    | Sens de communication      |
|--------------------|------------|----------------------------|
| Topic capteur      | `/sensor`  | Capteur → Fog              |
| Topic serveur      | `/server`  | Fog → Capteur              |

Exemple pour un capteur `esp32-dht22-topic` :
- `esp32-dht22-topic/sensor` : le capteur publie ici
- `esp32-dht22-topic/server` : le fog publie ici (reponses, commandes)

Le fog-service s'abonne au wildcard `#` pour capter tous les topics.

---

## Messages capteur → Fog (`/sensor`)

Tous les messages sont en JSON.

### PING — Signal de presence

Envoye periodiquement (toutes les 20 secondes) pour signaler que le capteur est en ligne.
Le fog remet a zero un timeout de 30 secondes a chaque ping. Si aucun ping n'est recu pendant 30 secondes, le capteur est considere hors ligne et la session est automatiquement cloturee.

```json
{ "cmd": "ping" }
```

### START — Demande de debut de session

Envoye par le capteur pour demander au fog de demarrer une session d'acquisition.

```json
{ "cmd": "start" }
```

Le fog repond avec un ACK (voir ci-dessous). La session est relancee toutes les 30 secondes si aucun ACK n'est recu.

### STOP — Demande d'arret de session

Envoye par le capteur pour terminer la session (ex. Ctrl+C sur le simulateur).

```json
{ "cmd": "stop" }
```

### MEASURES — Publication de donnees

Envoye a chaque cycle de mesure. `timestamp` est en millisecondes (epoch Unix). `measures` est un tableau de paires type/valeur.

```json
{
  "timestamp": 1735000000000,
  "measures": [
    { "measureType": "temperature", "value": 23.5 },
    { "measureType": "humidity",    "value": 61.2 }
  ]
}
```

Types de mesures supportes (definis en base de donnees) : `ecg`, `temperature`, `humidity`.

---

## Messages Fog → Capteur (`/server`)

### ACK — Confirmation de demarrage

Envoye par le fog en reponse a un message `start`. Le capteur peut commencer a publier des donnees.

```json
{ "ans": "ack" }
```

---

## Flux de protocole complet

```
Capteur                              Fog
   |                                   |
   |--- { "cmd": "ping" } ------------>|  (reset timeout 30s)
   |--- { "cmd": "start" } ----------->|  (Kafka START publie)
   |<-- { "ans": "ack" } -------------|
   |--- { timestamp, measures: [...] }->|  (bufferise)
   |--- { timestamp, measures: [...] }->|  (bufferise)
   |--- { "cmd": "ping" } ------------>|  (reset timeout 30s)
   |--- { timestamp, measures: [...] }->|  (flush Kafka DATA apres 1s ou 10 entrees)
   |--- { "cmd": "stop" } ----------->|  (flush + Kafka STOP publie)
   |                                   |
```

---

## Auto-decouverte

Le fog ecoute le wildcard `#`. Si un message `measures` arrive depuis un topic inconnu (non enregistre en base), ce topic est ajoute a la liste des `discoveredTopics` accessible via `GET /api/v1/sensors/discovered`. Un administrateur peut ensuite enregistrer ce capteur en base.

---

## Configuration capteur (Portail captif ESP32)

Les sketches Arduino integrent un portail captif WiFiManager permettant de configurer :

- SSID et mot de passe WiFi
- URL du broker MQTT (`MQTT_HOST`)
- Port MQTT (`MQTT_PORT`)
- Identifiants MQTT (`MQTT_USER`, `MQTT_PASS`)
- Nom du capteur (qui devient le topic de base)
