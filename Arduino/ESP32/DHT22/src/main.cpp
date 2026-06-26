#include <Arduino.h>
#include "SpecificConstants.hpp"
#include "MQTTCommonOperations.hpp"
#include "SensorRunner.hpp"
#include "Sensor.hpp"

// Migration vers le socle commun (cf. docs/FIRMWARE_ARCHITECTURE.md) : le main
// ne contient plus de logique réseau/MQTT/loop dupliquée. On déclare le driver
// du capteur et on délègue tout au SensorRunner.

WiFiClient espClient;
PubSubClient client(espClient);
Dht22Sensor dhtSensor;

// allow_to_publish / INTERVAL / MQTT_PORT proviennent de SpecificConstants.
SensorRunner runner(client, dhtSensor, allow_to_publish, MQTT_PORT, INTERVAL);

void setup() {
  runner.setup();
}

void loop() {
  runner.loop();
}
