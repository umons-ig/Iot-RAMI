#ifndef SENSOR_RUNNER_HPP
#define SENSOR_RUNNER_HPP

#include <PubSubClient.h>
#include "ISensor.hpp"

// Orchestrateur commun : remplace les main.cpp/loop()/callback() dupliqués dans
// chaque sketch (cf. docs/FIRMWARE_ARCHITECTURE.md). Gère WiFi/MQTT/NTP, le
// protocole ping/start/stop, l'échantillonnage périodique du capteur et la
// publication de ses mesures. Le capteur (ISensor) ne connaît plus le transport.
//
// Hypothèse : une seule instance par firmware (un device = un runner).
class SensorRunner {
public:
  // allowToPublish : référence vers le flag global du sketch (piloté par les
  // commandes start/stop reçues). mqttPort : port du broker. sampleIntervalMs :
  // cadence d'échantillonnage (= INTERVAL du capteur).
  SensorRunner(PubSubClient& client, ISensor& sensor, bool& allowToPublish,
               int mqttPort, long sampleIntervalMs);

  void setup();  // à appeler depuis setup()
  void loop();   // à appeler depuis loop()

  // Callback MQTT (branché automatiquement). Public pour le trampoline interne.
  void onMqttMessage(char* topic, uint8_t* payload, unsigned int length);

private:
  PubSubClient& client;
  ISensor& sensor;
  bool& allowToPublish;
  int mqttPort;
  long sampleIntervalMs;

  unsigned long previousSample = 0;
  unsigned long previousPing = 0;
  unsigned long previousStart = 0;
};

#endif // SENSOR_RUNNER_HPP
