# Firmware ESP32 — architecture cible (config-driven, multi-capteurs)

> Document de conception. Issu de la revue critique du firmware (rapidité, WiFi,
> extensibilité) et de l'objectif : **un code principal unique**, le choix du/des
> capteur(s) au flash, et la configuration (pins, WiFi, MQTT) depuis le **portail
> captif**. Rien n'est implémenté ici — ce document cadre le refactor.

## 1. Problème avec l'architecture actuelle

5 sketches (DHT22, BME280, AD8232, HCSR04, MR60BHA2) avec `main.cpp`/`callback`/
`loop` **dupliqués à l'identique**. Conséquences (cf. revue) :
- une correction = 5 éditions → divergences (le bug AD8232 « 1 Hz au lieu de
  100 Hz » vient de là : corrigé sur HCSR04/MR60BHA2, pas sur AD8232) ;
- pas de reconnexion WiFi ni de watchdog ;
- acquisition et publication mélangées, interface `Sensor` trop pauvre
  (MR60BHA2 a dû ajouter `updateSensor()` ad hoc pour l'UART) ;
- ajouter un capteur = créer un projet entier.

## 2. Architecture cible

**Un seul firmware**, organisé autour d'un **registre de drivers** et d'un socle
commun. Le ou les capteurs actifs + leurs pins sont **choisis/configurés sans
réécrire de code**.

```
firmware/
  core/
    NetworkManager   — machine à états : BOOT → WIFI_CONNECTING → WIFI_OK
                       → MQTT_CONNECTING → MQTT_OK → STREAMING ; reconnexion
                       WiFi ET MQTT, reset watchdog à chaque transition
    TimeService      — NTP non-bloquant ; offset epoch↔esp_timer ; datation µs monotone
    Transport        — publish + BATCHING ; StaticJsonDocument réutilisé (zéro alloc/échantillon)
    ConfigStore      — schéma de config en NVS (WiFi, MQTT, liste de capteurs+pins)
    SensorRunner     — setup()/loop()/callback() UNIQUES ; orchestre les ISensor
    SensorRegistry   — table "type" → fabrique d'ISensor
  drivers/
    ISensor (interface) — begin(cfg) ; poll() [opt., UART/FIFO] ; read(out[], &count)
    Dht22Sensor, Bme280Sensor, Ad8232Sensor, Hcsr04Sensor, Mr60bha2Sensor, …
```

### Interface capteur (le seul contrat à implémenter par driver)
```cpp
struct Measure { const char* type; float value; };

class ISensor {
public:
  virtual bool begin(const SensorConfig& cfg) = 0;   // pins/adresse/params
  virtual void poll() {}                              // optionnel (UART/FIFO)
  virtual int read(Measure* out, int maxOut) = 0;     // remplit out[], renvoie le nb
  virtual ~ISensor() {}
};
```
Ajouter un capteur = **écrire un driver** (1 fichier) + l'enregistrer dans le
`SensorRegistry`. Le `SensorRunner` et tout le réseau ne changent pas.

### Configuration (portail captif → NVS)
Le portail WiFiManager (custom parameters) édite et persiste en NVS :
```json
{
  "wifi": { "ssid": "...", "pass": "..." },
  "mqtt": { "host": "...", "port": 1883, "user": "...", "pass": "...", "name": "esp32-salon-01" },
  "sensors": [
    { "type": "bme280", "bus": "i2c", "address": "0x76" },
    { "type": "ad8232", "bus": "analog", "pins": { "out": 34, "loPlus": 32, "loMinus": 33 }, "rateHz": 250 }
  ]
}
```
Au boot, `ConfigStore` lit la config → `SensorRegistry` instancie les drivers
demandés avec leurs pins. **Aucune recompilation pour changer de pins/capteur.**

### Deux variantes de packaging (non exclusives)
| | Au flash | Page de config | Binaire |
|---|---|---|---|
| **A. Universel** | rien | cocher capteurs + pins + WiFi | tous les drivers (~ok sur 4 Mo) |
| **B. Slim au build** | choisir capteurs (`build_flags`/`build_src_filter`) | pins + WiFi | seuls les drivers choisis |

Même socle dans les deux cas. Viser **A** par défaut (déploiement « un firmware
pour tout le parc »), garder **B** comme option pour les cibles contraintes.

#### Taille flash / partitions (le binaire universel rentre-t-il ?)
Préoccupation légitime sur ESP32 (souvent **4 Mo**). En pratique :
- L'essentiel du poids (stack WiFi, mbedTLS, core Arduino, ArduinoJson) est
  **partagé** : une app capteur-unique pèse déjà ~1 Mo. Les **drivers** sont
  petits (~dizaines de Ko chacun) → une dizaine ajoute **~100-300 Ko**. Binaire
  universel ≈ **1,2-1,4 Mo**.
- **Schéma de partition** : `huge_app` (3 Mo app, sans OTA) → large ; `min_spiffs`
  (1,9 Mo/slot, **avec OTA**) → passe aussi. À fixer dans `platformio.ini`
  (`board_build.partitions`).

**Garde-fous** :
1. **Variante B (slim au build)** : si ça ne rentre pas (ou pour de l'OTA
   confortable sur 4 Mo), compiler uniquement les drivers choisis
   (`build_src_filter`/`-D ENABLE_<DRIVER>`).
2. **Modules 8/16 Mo** (ex. WROVER 16 Mo) pour le binaire universel + OTA.
3. **Mesurer** la taille (`pio run` affiche le % flash) à chaque driver ajouté ;
   CI peut alerter si on dépasse un seuil.

Décision : **A + `huge_app`** par défaut, bascule en **B** pour les cibles
contraintes — les deux partagent 100 % du socle.

## 3. Acquisition haute fréquence (ECG) — tâche FreeRTOS

Pour l'ECG (250-500 Hz), l'acquisition ne doit pas partager `loop()` avec le
portail web/MQTT. Cible :
- une **tâche FreeRTOS épinglée sur le core 1** lit l'ADC via **timer matériel**,
  pousse dans une `xQueue` ;
- la tâche réseau (core 0) draine la file, **batche** (`t0` + `dt` + `values[]`,
  cf. `docs/MULTI_PROTOCOL_ZIGBEE.md` §6) et publie.
Les capteurs lents (I2C/UART) restent en `poll()`/`read()` périodique côté runner.

## 4. Fixes chirurgicaux à appliquer (avant/pendant le refactor)

| # | Fix | Fichier | Effort |
|---|-----|---------|--------|
| 1 | ECG `>= 1000` → `>= INTERVAL` (1 Hz → 100 Hz) | `AD8232/src/main.cpp:88` | S |
| 2 | `setBufferSize(512)` dans le commun + **logger l'échec de `publish()`** | `Common/MQTTCommonOperations.cpp` | S |
| 3 | `retained=false` par défaut pour les mesures | `Common/MQTTCommonOperations.hpp` | S |
| 4 | Retirer `DAYLIGHT_OFFSET_SEC=3600` (epoch UTC strict) | `Common/MQTTCommonOperations.cpp:42` | S |
| 5 | Reconnexion **WiFi** dans `loop()` (`WiFi.status()`/`reconnect()`) | `Common` | S |
| 6 | **Watchdog** matériel (`esp_task_wdt`) + reset en tête de `loop()` | `Common` | S |
| 7 | NTP non-bloquant (`getLocalTime(&t,0)` + offset) ; ne plus abandonner les mesures en silence | `Common/MQTTCommonOperations.cpp` | M |
| 8 | Supprimer code mort (`publishValue`, `*_RESPONSE`) ; cohérence topic `-topic/sensor` vs doc | divers | S |

## 5. Articulation avec Zigbee / Z2M (stratégie d'extensibilité)

> **La « plus grande gamme de capteurs » vient surtout de Zigbee, pas de plus de firmware.**

- Les capteurs **d'environnement** (temp/humidité/pression/présence/qualité d'air)
  existent en **Zigbee certifié** → **aucun firmware custom**, Z2M les expose en
  MQTT (cf. `docs/MULTI_PROTOCOL_ZIGBEE.md`). Cela **élimine 4 des 5 sketches** et
  tout le poids WiFi/NTP/watchdog associé.
- Le firmware ESP32 custom se **recentre sur ce que Zigbee ne sait pas faire** :
  l'**acquisition haute fréquence (ECG)**. C'est là que l'effort §3 (FreeRTOS +
  batching + datation) est pleinement justifié.

→ L'extensibilité devient : **config Z2M** (capteurs du commerce) **+** registre de
drivers (capteurs spécifiques/haute fréquence). Le firmware config-driven sert
surtout les cas custom ; Z2M absorbe le « tout-venant ».

## 6. Plan de migration (incrémental — compilation/flash à chaque étape)

1. **Fixes chirurgicaux** (§4 #1-6) sur l'archi actuelle — gains immédiats, faible risque.
2. **Extraire le socle commun** : remonter `loop()`/`callback()`/`setup()` dans
   `core/SensorRunner` ; définir `ISensor` ; migrer **un** capteur (DHT22) en driver.
3. **Migrer les autres drivers** un par un (compiler/flasher entre chaque).
4. **ConfigStore + portail captif** (pins/capteurs en NVS) → binaire universel (variante A).
5. **Tâche FreeRTOS + batching** pour l'ECG (variante haute fréquence).
6. En parallèle infra : **adaptateur Z2M côté fog** pour offloader les capteurs d'environnement.

> ⚠️ Chaque étape doit être **compilée et flashée** (PlatformIO) puis validée sur
> matériel — le refactor ne doit pas être fait « d'un bloc » à l'aveugle.
