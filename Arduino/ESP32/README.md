# Sketches ESP32 — Capteurs RAMI

Firmware ESP32 des capteurs RAMI, organisé en projets **PlatformIO** (un projet par capteur)
partageant une bibliothèque commune `Common/`. Chaque capteur parle le même protocole MQTT que
le simulateur Python (voir [`docs/MQTT.md`](../../docs/MQTT.md)).

## Structure

```
Arduino/ESP32/
├── Common/          # Lib partagée : MQTTCommonOperations (WiFi, MQTT, handshake, NTP)
├── AD8232/          # ECG
├── DHT22/           # Température + humidité
├── BME280/          # Température + humidité + pression (I2C)
├── HCSR04/          # Distance (ultrason)
└── MR60BHA2/        # Présence / rythme cardiaque (mmWave, UART)
```

Chaque projet capteur contient :
- `src/main.cpp` — boucle principale : WiFi/MQTT, handshake (`start`/`ping`), publication.
- `src/Sensor.cpp` / `src/Sensor.hpp` — lecture du capteur (définit les **pins**).
- `src/SpecificConstants.cpp` / `.hpp` — config spécifique (types de mesures, cadence, certificat).
- `platformio.ini` — board, dépendances épinglées, lien `symlink://../Common`.

La lib `Common/` (`MQTTCommonOperations`) factorise : connexion WiFi via **WiFiManager**
(portail captif), connexion MQTT + reconnexion, handshake protocolaire, horodatage NTP, et la
sérialisation des messages.

## Brochage (pins) par capteur

| Capteur | Signal | Pin ESP32 |
|---------|--------|-----------|
| **AD8232** (ECG) | LO+ (leads-off +) | GPIO13 |
| | LO− (leads-off −) | GPIO12 |
| | Sortie analogique (OUTPUT) | GPIO14 |
| **DHT22** | Data | GPIO27 |
| **HC-SR04** | TRIG | GPIO22 |
| | ECHO | GPIO23 |
| **MR60BHA2** (mmWave) | UART0 TX | GPIO16 (D6) — défaut ESP32-C6 |
| | UART0 RX | GPIO17 (D7) — défaut ESP32-C6 |
| **BME280** | I2C SDA / SCL | défaut ESP32 (GPIO21 / GPIO22) — *à confirmer selon le câblage* |

> Les pins proviennent des `#define` dans chaque `src/Sensor.hpp`. Le MR60BHA2 utilise `Serial0`
> avec les pins UART par défaut de l'ESP32-C6. Le BME280 utilise le bus I2C (`Wire`) sans pins
> explicites → pins I2C par défaut de la carte.

## Provisioning (portail captif WiFiManager)

Aucun secret n'est codé en dur : à la première mise sous tension (ou après reset), l'ESP32 ouvre
un point d'accès et un **portail captif** permettant de saisir :

- SSID + mot de passe WiFi
- URL et port du broker MQTT
- Identifiants MQTT (utilisateur / mot de passe)
- **Nom du capteur** → devient le topic de base (`<nom>/sensor` et `<nom>/server`)

Ces valeurs sont persistées en **NVS** (`Preferences`) et rechargées au démarrage. Un appui long
sur le **bouton BOOT** efface la configuration et relance le portail.

## Flasher

Avec [PlatformIO](https://platformio.org/) (CLI ou extension VS Code) :

```bash
cd Arduino/ESP32/<CAPTEUR>      # ex. AD8232
pio run                         # compiler
pio run --target upload         # flasher la carte connectée en USB
pio device monitor              # moniteur série
```

La première compilation télécharge les dépendances déclarées dans `platformio.ini` (cache local
`.pio/`, git-ignoré).

## Protocole

Voir [`docs/MQTT.md`](../../docs/MQTT.md) pour la spécification complète : topics dédoublés,
handshake `ping`/`start`/`ack`/`stop`, format des messages de mesures.
