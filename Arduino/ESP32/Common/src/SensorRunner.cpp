#include <Arduino.h>
#include <ArduinoJson.h>
#include "SensorRunner.hpp"
#include "MQTTCommonOperations.hpp"

// Intervalles du protocole (identiques pour tous les capteurs).
static const long PING_INTERVAL_MS = 20000;
static const long START_INTERVAL_MS = 30000;
// Nombre maximal de mesures publiées en un message.
static const int MAX_MEASURES = 12;

// Trampoline : PubSubClient attend un pointeur de fonction C ; on route vers
// l'instance unique du runner.
static SensorRunner* g_runner = nullptr;
static void mqttTrampoline(char* topic, uint8_t* payload, unsigned int length) {
  if (g_runner) g_runner->onMqttMessage(topic, payload, length);
}

SensorRunner::SensorRunner(PubSubClient& client, ISensor& sensor,
                           bool& allowToPublish, int mqttPort,
                           long sampleIntervalMs)
    : client(client), sensor(sensor), allowToPublish(allowToPublish),
      mqttPort(mqttPort), sampleIntervalMs(sampleIntervalMs) {}

void SensorRunner::setup() {
  Serial.begin(115200);
  setup_wifi();  // + watchdog/reconnexion WiFi (cf. Common)
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  sensor.begin();
  client.setServer(saved_broker, mqttPort);
  g_runner = this;
  client.setCallback(mqttTrampoline);
}

void SensorRunner::onMqttMessage(char* topic, uint8_t* payload,
                                 unsigned int length) {
  String received;
  received.reserve(length);
  for (unsigned int i = 0; i < length; i++) received += (char)payload[i];

  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, received)) return;  // JSON invalide -> ignoré

  if (doc.containsKey(MSG_CMD)) {
    String cmd = doc[MSG_CMD];
    interactWithReceivedCommand(client, cmd, saved_topic_sensor, allowToPublish);
  } else if (doc.containsKey(MSG_ANS)) {
    String ans = doc[MSG_ANS];
    interactWithAnswerCommand(client, ans, saved_topic_sensor, allowToPublish);
  }
}

void SensorRunner::loop() {
  if (!client.connected()) {
    reconnect(client, saved_username, saved_password, saved_topic_server);
    if (client.connected()) {
      sendPing(client, saved_topic_sensor);
      sendStart(client, saved_topic_sensor);
      previousPing = millis();
      previousStart = millis();
    }
  }
  client.loop();
  processWifiManager();  // reconnexion WiFi + reset watchdog (Common)

  const unsigned long now = millis();

  // Tant que la session n'est pas démarrée, on ré-émet START périodiquement.
  if (!allowToPublish && now - previousStart >= START_INTERVAL_MS) {
    previousStart = now;
    sendStart(client, saved_topic_sensor);
  }

  if (now - previousPing >= PING_INTERVAL_MS) {
    previousPing = now;
    sendPing(client, saved_topic_sensor);
  }

  // Échantillonnage périodique + publication (uniquement si session active).
  if (now - previousSample >= (unsigned long)sampleIntervalMs) {
    previousSample = now;
    if (allowToPublish) {
      sensor.poll();
      SensorMeasure measures[MAX_MEASURES];
      const int n = sensor.read(measures, MAX_MEASURES);
      if (n > 0) {
        const char* types[MAX_MEASURES];
        float values[MAX_MEASURES];
        for (int i = 0; i < n; i++) {
          types[i] = measures[i].type;
          values[i] = measures[i].value;
        }
        publishMeasures(client, saved_topic_sensor, types, values, n);
      }
    }
  }
}
