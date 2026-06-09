# Conception — Standardisation MQTT & intégration Home Assistant

> Document de conception (non encore implémenté). Objectif : standardiser les paquets/topics MQTT
> (à la manière de `zigbee2mqtt`) pour ajouter des capteurs — y compris **non-médicaux** — en
> quelques minutes, et permettre une intégration **Home Assistant** par auto-découverte.

## 1. Problème actuel

- L'ajout d'un capteur suppose une convention implicite (`<topic>/sensor`, payload
  `{ timestamp, measures: [...] }`) connue de tête, sans contrat formel de capacités.
- Aucune description des capacités d'un capteur (types de mesures, unités, plages) → le backend
  auto-découvre le topic mais pas la sémantique.
- Pas d'interopérabilité avec l'écosystème domotique.

## 2. Standardisation des paquets (modèle zigbee2mqtt)

### 2.1 Convention de topics

```
rami/<sensor_id>/announce          # message de découverte (capacités) — retained
rami/<sensor_id>/state             # mesures (le capteur publie)
rami/<sensor_id>/cmd               # commandes (start/stop/ping) — équivalent du /server actuel
rami/<sensor_id>/availability      # online/offline (LWT MQTT) — retained
```

> Migration douce : conserver la compatibilité avec les topics actuels `<topic>/sensor` &
> `<topic>/server` le temps de la transition, ou mapper dans le fog.

### 2.2 Message d'annonce (capacités)

Publié en **retained** à la connexion, décrit ce que le capteur sait produire :

```json
{
  "sensor_id": "esp32-salon-01",
  "model": "DHT22",
  "manufacturer": "RAMI",
  "measures": [
    { "type": "temperature", "unit": "°C", "min": -40, "max": 80 },
    { "type": "humidity",    "unit": "%",  "min": 0,   "max": 100 }
  ],
  "medical": false
}
```

- Le **flag `medical`** distingue les capteurs cliniques (flux tracé/conservé) des capteurs
  domotiques. **Essentiel** : il permet de ne PAS mélanger les niveaux de criticité.
- Le backend `auto-discover` (déjà présent via wildcard `#`) consomme `announce` pour enregistrer
  le capteur **avec sa sémantique** (plus seulement le topic).

### 2.3 LWT (Last Will & Testament)

Déclarer un LWT MQTT sur `rami/<id>/availability` = `offline` → statut capteur instantané et
fiable côté broker, sans dépendre du timeout ping applicatif (30 s actuel).

## 3. Intégration Home Assistant (MQTT Discovery)

Home Assistant auto-découvre tout appareil qui publie un message de config sur
`homeassistant/<component>/<node_id>/<object_id>/config`. Le **fog est déjà le hub MQTT** : il
peut agir comme **pont de découverte**.

### 3.1 Principe

Pour chaque mesure annoncée par un capteur, le pont publie un message discovery HA :

```
Topic : homeassistant/sensor/esp32-salon-01/temperature/config   (retained)
Payload :
{
  "name": "Salon Température",
  "unique_id": "esp32-salon-01_temperature",
  "state_topic": "rami/esp32-salon-01/state",
  "value_template": "{{ value_json.measures | selectattr('measureType','eq','temperature') | map(attribute='value') | first }}",
  "unit_of_measurement": "°C",
  "device_class": "temperature",
  "availability_topic": "rami/esp32-salon-01/availability",
  "device": { "identifiers": ["esp32-salon-01"], "model": "DHT22", "manufacturer": "RAMI" }
}
```

→ Le capteur apparaît **automatiquement** dans Home Assistant, sans configuration manuelle.

### 3.2 Architecture recommandée

```
                 ┌─────────────── flux MÉDICAL (inchangé) ──────────────┐
Capteur ──MQTT──►│ fog-service ──► Kafka ──► backend ──► TimescaleDB    │
        (broker) └──────────────────────────────────────────────────────┘
            │
            └────► pont HA (service séparé) ──► topics homeassistant/.../config
                   (lit announce, publie discovery, relaie state)
```

- **Pont HA = service distinct** (pas dans le chemin médical critique). Il s'abonne aux `announce`
  et republie les messages discovery + relaie les `state`. Isolation des criticités.
- Filtrer : par défaut, n'exposer à HA que les capteurs `medical: false`, ou selon une allowlist.

## 4. Bénéfices

- Ajout de capteur **plug-and-play** (le contrat de capacités suffit).
- Ouverture à l'écosystème domotique (HA) sans toucher au backend médical.
- Terrain de prototypage pour de nouveaux capteurs.

## 5. Étapes suggérées

1. Définir et documenter le schéma `announce` + les topics standard (compat ascendante).
2. Faire émettre `announce` (retained) + LWT `availability` par les firmwares ESP32 (lib `Common/`)
   et le simulateur Python.
3. Adapter l'auto-discover backend pour consommer `announce` (sémantique des mesures).
4. Développer le **pont HA** comme service séparé (Node ou Python) : `announce` → discovery HA,
   relais `state`, respect du flag `medical`.
5. Tester avec une instance Home Assistant (add-on Mosquitto ou broker existant).

> Voir [`MQTT.md`](./MQTT.md) pour le protocole capteur actuel et
> [`ETAT_DES_LIEUX.md`](./ETAT_DES_LIEUX.md) pour le contexte global.
