# RamiFirmware — firmware ESP32 unifié (config-driven)

Un **seul** code pour tous les capteurs ESP32 de RAMI. On choisit le(s) capteur(s)
**au flash** (environnement PlatformIO), on configure **WiFi/MQTT** sur le portail
captif au premier démarrage, et les **pins/adresses** via `build_flags`.

> Remplace progressivement les 5 sketches dédiés (DHT22, BME280, …).
> Architecture détaillée : [`docs/FIRMWARE_ARCHITECTURE.md`](../../../docs/FIRMWARE_ARCHITECTURE.md).
> ⚠️ À **compiler/flasher** pour valider (non testé en CI).

## Flasher

```bash
pio run -e dht22 -t upload            # un DHT22 sur GPIO 27
pio run -e bmp280 -t upload           # un BMP280 en I2C 0x76
pio run -e dht22_bmp280 -t upload     # les deux sur le même ESP32
```

Au 1ᵉʳ boot : se connecter au point d'accès du portail captif → renseigner WiFi +
broker/identifiants MQTT + nom du capteur. (Maintenir BOOT/GPIO0 au démarrage pour
réinitialiser ces réglages.)

## Architecture

```
src/main.cpp              — déclare les drivers actifs (#ifdef ENABLE_*) -> CompositeSensor -> SensorRunner
src/drivers/<X>Driver.*   — un driver = une classe ISensor (begin/poll/read)
Common/ (lib partagée)    — SensorRunner (loop/MQTT/WiFi/NTP/watchdog), ISensor, CompositeSensor
```

## Ajouter un capteur

1. Créer `src/drivers/<X>Driver.{hpp,cpp}` (classe `: public ISensor`, le tout sous `#ifdef ENABLE_<X>`).
2. Ajouter un bloc `#ifdef ENABLE_<X>` dans `main.cpp` (include + `sensors.add(&driver)`).
3. Ajouter un `[env:...]` avec `-D ENABLE_<X>` (+ pins) dans `platformio.ini`.

Aucune logique réseau/MQTT à écrire : le `SensorRunner` s'en charge.
