# RAMI multi-protocole — intégration Zigbee2MQTT & format de paquet unifié

> Document de conception (design doc). Issu de la revue critique du protocole MQTT
> (capteurs ESP32 → fog) et de l'objectif « passer à l'échelle (presque une
> infinité de capteurs) » en s'appuyant sur le modèle Zigbee2MQTT (Z2M).
> Rien n'est implémenté ici : ce document cadre le travail cross-stack à venir.

## 1. Objectif

Faire de RAMI un système **multi-protocole** :

- **Voie « médicale » haute fréquence** (existante) : ESP32 → MQTT custom → fog.
  Série temporelle **horodatée à la source** (ECG, multi-mesures). Inchangée dans
  son principe (c'est la valeur du projet).
- **Voie « Zigbee »** (nouvelle) : appareils Zigbee du commerce → coordinateur USB
  → **Zigbee2MQTT** → même broker Mosquitto → fog. Capteurs d'environnement
  bas débit (température, humidité, contact, présence, batterie…), **plug-and-play**.

Bénéfice : un réseau Zigbee + Z2M gère nativement des **centaines d'appareils**
avec appairage/découverte automatique → c'est le levier « presque infini ».

## 2. Pourquoi Z2M est le bon modèle (et ce qu'on n'en prend PAS)

Z2M scale grâce à : (a) **un topic par appareil**, (b) un **payload plat
auto-descriptif** (`{ "temperature": 21, "humidity": 50 }`), (c) un **message de
capacités *retained*** (`zigbee2mqtt/bridge/devices`) qui décrit chaque appareil.

⚠️ Ce qu'on **ne copie pas** : le modèle « snapshot d'état **sans timestamp** »
de Z2M. Il horodate à la réception — acceptable pour de la domotique lente,
**inutilisable pour l'ECG** (haute fréquence, gigue réseau, batching). On garde
donc **deux modèles de données** selon la *device class* (cf. §5).

## 3. Architecture cible

```
 Appareils Zigbee ─┐
                   ▼
            [dongle USB]            ESP32 (médical) ─┐
                   ▼                                  ▼
              Z2M (conteneur)                   MQTT custom
                   │  publie zigbee2mqtt/<device>     │  <name>/sensor
                   ▼                                  ▼
                 ┌──────────────  Mosquitto (fog, abonné #)  ──────────────┐
                 │                         fog-service                      │
                 │   handleMessageReceivedFromSensor (routeur de topics)    │
                 │      ├─ topic zigbee2mqtt/*   → adaptateur Z2M ──────┐    │
                 │      └─ topic <name>/sensor   → voie médicale ───────┤    │
                 │                                       outbox (store-and-forward)
                 └───────────────────────────────────────────────────────────┘
                                          ▼
                                   Kafka → backend → TimescaleDB / WebSocket
```

Le fog **est déjà abonné à `#`** : les messages Z2M arrivent sans config réseau
supplémentaire. Il suffit d'un **adaptateur de topic** `zigbee2mqtt/*`.

## 4. Adaptateur Z2M côté fog (cœur du chantier)

Dans `mqttFog.ts`, ajouter une branche de routage : si le topic commence par
`zigbee2mqtt/` et n'est pas `zigbee2mqtt/bridge/*` :

1. `deviceName = topic.slice("zigbee2mqtt/".length)`.
2. Parser le payload plat `{ clé: valeur, … }`.
3. Mapper chaque clé numérique connue → `measureType` (table de correspondance,
   ex. `temperature`, `humidity`, `pressure`, `battery`, `linkquality`,
   `occupancy`→0/1, `contact`→0/1). Ignorer les clés non numériques/non mappées.
4. Construire un message RAMI : `{ timestamp_µs: receptionTime*1000, measures:[{measureType,value}] }`
   et l'injecter **dans le même flux que la voie médicale** (outbox → Kafka).
5. `zigbee2mqtt/bridge/devices` (retained) → alimente l'**auto-discover** (création
   des `Sensor` Zigbee + `MeasurementType` avec **unités/plages** issues des
   `exposes` Z2M).

Le backend, Kafka, TimescaleDB, le WebSocket et l'UVI **ne changent pas** : un
capteur Zigbee devient un `Sensor` comme un autre.

## 5. Les 2 décisions de design

### 5.1 Horodatage par *device class*
| Voie | Timestamp | Justification |
|---|---|---|
| Médicale (ESP32) | **à la source (µs, NTP)** | ECG/haute fréquence : la réception ≠ l'acquisition |
| Zigbee (Z2M) | **à la réception (fog)** | bas débit, pas de timestamp dans le payload Z2M ; suffisant |

### 5.2 Modèle de session pour appareils « continus » (sans START/STOP)
Un appareil Zigbee **publie en continu**, il n'a ni PING ni START/STOP. Or RAMI
est *session-driven*. Solution : **session glissante automatique** pour les
capteurs Zigbee :
- 1ʳᵉ donnée reçue → ouverture auto d'une session ;
- rotation périodique (réutiliser `sessionMaxDurationMs`) pour borner les sessions ;
- clôture sur **silence prolongé** — le **watchdog « capteur muet » (§4.2 déjà
  implémenté côté backend)** convient parfaitement.

> ⚠️ Décision à valider : faut-il un *flag* `continuous: true` sur le `Sensor`
> (Zigbee) pour distinguer ce mode du mode session classique (ESP32) ?

## 6. Format de paquet unifié (versionné, inspiré Z2M)

Pour harmoniser les deux voies et préparer l'avenir, faire évoluer le paquet de
mesure RAMI (voie médicale) vers un schéma **versionné + auto-descriptif** :

```json
{
  "v": 1,
  "timestamp": 1735000000123456,        // µs (voie médicale uniquement)
  "seq": 12345,                          // n° de séquence par capteur (détection de pertes QoS 0)
  "measures": [
    { "measureType": "temperature", "value": 23.5, "unit": "°C" }
  ]
}
```

- **`v`** : versionnage → faire évoluer sans casser le parsing fog (routage par `v`).
- **`seq`** : détecter les trous (tout est QoS 0) → métrique de perte (le fog a déjà `dropCount`).
- **`unit`** : aujourd'hui implicite (BME280 divise la pression /100 sans le dire) ;
  côté front on a dû mapper les unités en dur (`MEASURE_UNITS`) — le paquet devrait
  les porter.
- **Topic capacités *retained*** `<name>/sensor/config` (façon `bridge/devices`) :
  `{ "v":1, "measures":[{ "type":"temperature","unit":"°C","min":-40,"max":80 }] }`.

### Format batch colonne pour l'ECG (haute fréquence)
Le « 1 message MQTT par échantillon » ne tient pas à 250-500 Hz. Format batch :

```json
{ "v":1, "t0":1735000000000000, "dt":4000, "type":"ecg", "unit":"mV",
  "seq":42, "values":[512,514,511, …] }
```

`t0` = timestamp de base (µs), `dt` = pas entre échantillons (µs), `values` =
tableau brut. Garde les timestamps (base + pas), **divise le nombre de messages
par ~256**. Nécessite un dé-batchage côté `mqttFog.ts` (aligné avec
`normalizeTimestampMicros` du backend).

## 7. Bugs MQTT à corriger en parallèle (issus de la revue)

| # | Problème | Sévérité | Effort |
|---|----------|----------|--------|
| 1 | `setBufferSize(512)` absent de 4 sketches/5 + retour de `publish()` ignoré → **perte totale silencieuse** > 256 o | 🔴 | S |
| 2 | Mesures publiées en **`retained=true`** par défaut (`publishMeasures`) | 🔴 | S |
| 3 | `DAYLIGHT_OFFSET_SEC=3600` fausse l'epoch d'1 h + NTP non garanti convergé | 🔴 | M |
| 4 | ECG : 1 msg/mesure + bug `AD8232/main.cpp:88` (`>= 1000` au lieu de `INTERVAL`) → publie à **1 Hz** | 🔴 | M |
| 5 | START dupliqués dans l'outbox (pas de garde `buffer.has(topic)` avant enqueue) | 🟠 | S |
| 6 | Timeout fog 30 s vs ping 20 s (marge d'une seule perte) → viser ~50 s | 🟠 | S |
| 7 | `clientId` fog fixe (`FogServiceClient`) → collision si 2 instances | 🟠 | S |
| 8 | Code mort `publishValue`, `*_RESPONSE` ; doc `MQTT.md` divergente | 🟡 | S |

## 8. Plan d'exécution proposé

1. **Robustesse fog** (#5,#6,#7) — *testable en Jest*, sans matériel. → 1ʳᵉ PR.
2. **Fixes firmware sûrs** (#1,#2,#3,#4,#8) — je code, **à flasher/tester par toi**.
3. **Format unifié v1 + `seq` + topic `config`** — firmware + fog + backend (auto-discover unités).
4. **Adaptateur Z2M dans le fog** (§4) — *testable en Jest* (parsing de payloads Z2M simulés) ; service Z2M dans `fog-service/compose.yaml` (besoin d'un dongle pour le test réel).
5. **Session continue** (§5.2) + flag `continuous` sur `Sensor` (migration backend).
6. **Batch colonne ECG** (§6) — le plus ambitieux, débloque 250-500 Hz.

## 9. Matériel requis (Zigbee)
- Un **coordinateur Zigbee** USB (ex. Sonoff ZBDongle-E, ConBee II) branché sur le Pi fog.
- Quelques appareils Zigbee (capteurs température/humidité/présence) pour valider.
