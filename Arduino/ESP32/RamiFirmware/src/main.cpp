#include <Arduino.h>
#include "MQTTCommonOperations.hpp"
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
#ifndef MQTT_PORT
#define MQTT_PORT 1883
#endif
#ifndef SAMPLE_INTERVAL_MS
#define SAMPLE_INTERVAL_MS 1000
#endif

WiFiClient espClient;
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

void setup() {
  // Enregistrement des capteurs sélectionnés au build (avant runner.setup()).
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
  runner.setup();
}

void loop() {
  runner.loop();
}
