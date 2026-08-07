#include <Arduino.h>
#include "MQTTCommonOperations.hpp"
#include "MqttTransport.hpp"
#include "SensorRunner.hpp"
#include "CompositeSensor.hpp"

// ─────────────────────────────────────────────────────────────────────────────
// Firmware RAMI unifié, config-driven (cf. docs/FIRMWARE_ARCHITECTURE.md).
//
// UN seul code principal. Les capteurs présents sont sélectionnés AU BUILD via
// des define -D ENABLE_<DRIVER> (variante B « slim »), et leurs pins/adresses
// via -D <DRIVER>_PIN / _ADDR. Le WiFi/MQTT reste configuré sur le portail
// captif. Ajouter un capteur = ajouter un driver dans drivers/ + un bloc #ifdef.
//
// Exemple (platformio.ini) :
//   build_flags = -D ENABLE_DHT22 -D DHT22_PIN=27 -D ENABLE_BMP280
// ─────────────────────────────────────────────────────────────────────────────

#ifdef ENABLE_DHT22
#include "drivers/Dht22Driver.hpp"
#endif
#ifdef ENABLE_BMP280
#include "drivers/Bmp280Driver.hpp"
#endif
#ifdef ENABLE_AD8232
#include "drivers/Ad8232Driver.hpp"
#endif
#ifdef ENABLE_HCSR04
#include "drivers/Hcsr04Driver.hpp"
#endif
#ifdef ENABLE_MR60BHA2
#include "drivers/Mr60bha2Driver.hpp"
#endif
// ── Médical ──
#ifdef ENABLE_MAX30102
#include "drivers/Max30102Driver.hpp"
#endif
#ifdef ENABLE_MLX90614
#include "drivers/Mlx90614Driver.hpp"
#endif
#ifdef ENABLE_GSR
#include "drivers/GsrDriver.hpp"
#endif
// ── Domotique ──
#ifdef ENABLE_PIR
#include "drivers/PirDriver.hpp"
#endif
#ifdef ENABLE_BH1750
#include "drivers/Bh1750Driver.hpp"
#endif
#ifdef ENABLE_CONTACT
#include "drivers/ContactDriver.hpp"
#endif
#ifdef ENABLE_SGP30
#include "drivers/Sgp30Driver.hpp"
#endif

// Paramètres communs (surchargables au build).
// MQTT_PORT est défini par MqttTransport.hpp : 1883 en clair, 8883 en TLS.
#ifndef SAMPLE_INTERVAL_MS
#define SAMPLE_INTERVAL_MS 1000
#endif

// Transport MQTT : en clair par défaut, TLS si compilé avec -D RAMI_MQTT_TLS
// (cf. MqttTransport.hpp). La configuration TLS elle-même a lieu dans setup(),
// une fois Serial disponible.
Client& espClient = mqttTransport();
PubSubClient client(espClient);

// Flag piloté par les commandes start/stop (référencé par le SensorRunner).
bool allow_to_publish = false;

CompositeSensor sensors;

#ifdef ENABLE_DHT22
static Dht22Driver dht22Driver;
#endif
#ifdef ENABLE_BMP280
static Bmp280Driver bmp280Driver;
#endif
#ifdef ENABLE_AD8232
static Ad8232Driver ad8232Driver;
#endif
#ifdef ENABLE_HCSR04
static Hcsr04Driver hcsr04Driver;
#endif
#ifdef ENABLE_MR60BHA2
static Mr60bha2Driver mr60bha2Driver;
#endif
#ifdef ENABLE_MAX30102
static Max30102Driver max30102Driver;
#endif
#ifdef ENABLE_MLX90614
static Mlx90614Driver mlx90614Driver;
#endif
#ifdef ENABLE_GSR
static GsrDriver gsrDriver;
#endif
#ifdef ENABLE_PIR
static PirDriver pirDriver;
#endif
#ifdef ENABLE_BH1750
static Bh1750Driver bh1750Driver;
#endif
#ifdef ENABLE_CONTACT
static ContactDriver contactDriver;
#endif
#ifdef ENABLE_SGP30
static Sgp30Driver sgp30Driver;
#endif

SensorRunner runner(client, sensors, allow_to_publish, MQTT_PORT, SAMPLE_INTERVAL_MS);

#ifdef RUNTIME_SENSORS
// Variante A : ajoute un capteur par son nom (choisi au portail captif → NVS).
// Réutilise les instances statiques (toutes présentes en build « universal »).
static void addSensorByName(const String& name) {
#ifdef ENABLE_DHT22
  if (name == "dht22") { sensors.add(&dht22Driver); return; }
#endif
#ifdef ENABLE_BMP280
  if (name == "bmp280") { sensors.add(&bmp280Driver); return; }
#endif
#ifdef ENABLE_AD8232
  if (name == "ad8232") { sensors.add(&ad8232Driver); return; }
#endif
#ifdef ENABLE_HCSR04
  if (name == "hcsr04") { sensors.add(&hcsr04Driver); return; }
#endif
#ifdef ENABLE_MR60BHA2
  if (name == "mr60bha2") { sensors.add(&mr60bha2Driver); return; }
#endif
#ifdef ENABLE_MAX30102
  if (name == "max30102") { sensors.add(&max30102Driver); return; }
#endif
#ifdef ENABLE_MLX90614
  if (name == "mlx90614") { sensors.add(&mlx90614Driver); return; }
#endif
#ifdef ENABLE_GSR
  if (name == "gsr") { sensors.add(&gsrDriver); return; }
#endif
#ifdef ENABLE_PIR
  if (name == "pir") { sensors.add(&pirDriver); return; }
#endif
#ifdef ENABLE_BH1750
  if (name == "bh1750") { sensors.add(&bh1750Driver); return; }
#endif
#ifdef ENABLE_CONTACT
  if (name == "contact") { sensors.add(&contactDriver); return; }
#endif
#ifdef ENABLE_SGP30
  if (name == "sgp30") { sensors.add(&sgp30Driver); return; }
#endif
  Serial.print("[config] capteur inconnu ignore: ");
  Serial.println(name);
}
#endif // RUNTIME_SENSORS

void setup() {
#ifdef RUNTIME_SENSORS
  // Variante A : la liste des capteurs vient du portail captif (NVS, CSV).
  loadSavedSensorsFromNVS();
  String csv(saved_sensors);
  int start = 0;
  while (start <= (int)csv.length()) {
    int comma = csv.indexOf(',', start);
    String name = (comma < 0) ? csv.substring(start) : csv.substring(start, comma);
    name.trim();
    if (name.length()) addSensorByName(name);
    if (comma < 0) break;
    start = comma + 1;
  }
#else
  // Variante B : capteurs fixés au build (-D ENABLE_*).
#ifdef ENABLE_DHT22
  sensors.add(&dht22Driver);
#endif
#ifdef ENABLE_BMP280
  sensors.add(&bmp280Driver);
#endif
#ifdef ENABLE_AD8232
  sensors.add(&ad8232Driver);
#endif
#ifdef ENABLE_HCSR04
  sensors.add(&hcsr04Driver);
#endif
#ifdef ENABLE_MR60BHA2
  sensors.add(&mr60bha2Driver);
#endif
#ifdef ENABLE_MAX30102
  sensors.add(&max30102Driver);
#endif
#ifdef ENABLE_MLX90614
  sensors.add(&mlx90614Driver);
#endif
#ifdef ENABLE_GSR
  sensors.add(&gsrDriver);
#endif
#ifdef ENABLE_PIR
  sensors.add(&pirDriver);
#endif
#ifdef ENABLE_BH1750
  sensors.add(&bh1750Driver);
#endif
#ifdef ENABLE_CONTACT
  sensors.add(&contactDriver);
#endif
#ifdef ENABLE_SGP30
  sensors.add(&sgp30Driver);
#endif
#endif // RUNTIME_SENSORS (sinon variante B)
  runner.setup();
}

void loop() {
  runner.loop();
}
