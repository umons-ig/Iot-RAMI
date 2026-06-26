#include <Arduino.h>
#include <ArduinoJson.h>
#include "SensorRunner.hpp"
#include "MQTTCommonOperations.hpp"
#include "PinConfig.hpp"

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
  loadPinConfig();  // pins NVS chargées AVANT begin() (les drivers les lisent)
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
    // ── Commandes de GESTION À DISTANCE (depuis le web server du fog) ──
    if (cmd == "ota") {
      performOta(String((const char*)(doc["url"] | "")));
      return;
    }
    if (cmd == "set_mqtt") {
      saveMqttCreds(String((const char*)(doc["broker"] | "")),
                    String((const char*)(doc["user"] | "")),
                    String((const char*)(doc["pass"] | "")));
      ESP.restart();
      return;
    }
    if (cmd == "set_wifi") {
      saveWifiCreds(String((const char*)(doc["ssid"] | "")),
                    String((const char*)(doc["pass"] | "")));
      ESP.restart();
      return;
    }
    if (cmd == "restart") {
      ESP.restart();
      return;
    }
    // Sinon : protocole capteur classique (ping/start/stop).
    interactWithReceivedCommand(client, cmd, saved_topic_sensor, allowToPublish);
  } else if (doc.containsKey(MSG_ANS)) {
    String ans = doc[MSG_ANS];
    interactWithAnswerCommand(client, ans, saved_topic_sensor, allowToPublish);
  }
}

void SensorRunner::loop() {
  handleSerialConsole();  // config/tests via USB (Web Serial)
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

// ─── Console série USB (Web Serial) ──────────────────────────────────────────
// Lit des lignes JSON sur Serial et y répond en JSON. Les lignes non-JSON (logs
// de debug) sont ignorées par la page web côté parseur.
void SensorRunner::handleSerialConsole() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      processSerialLine(serialLine);
      serialLine = "";
    } else if (c != '\r') {
      serialLine += c;
      if (serialLine.length() > 400) serialLine = ""; // garde-fou
    }
  }
}

void SensorRunner::processSerialLine(const String& line) {
  if (line.length() == 0) return;
  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, line)) return; // pas du JSON -> ignoré
  const String cmd = doc["cmd"] | "";
  if (cmd.length() == 0) return;

  if (cmd == "info") {
    DynamicJsonDocument r(512);
    r["resp"] = "info";
    r["name"] = saved_name;
    r["sensors"] = saved_sensors;
    r["pins"] = getPinConfigJson();
    r["ip"] = WiFi.localIP().toString();
    r["connected"] = (WiFi.status() == WL_CONNECTED);
    serializeJson(r, Serial);
    Serial.println();
  } else if (cmd == "set_wifi") {
    saveWifiCreds(String((const char*)(doc["ssid"] | "")),
                  String((const char*)(doc["pass"] | "")));
    Serial.println("{\"resp\":\"set_wifi\",\"ok\":true}");
  } else if (cmd == "set_mqtt") {
    saveMqttCreds(String((const char*)(doc["broker"] | "")),
                  String((const char*)(doc["user"] | "")),
                  String((const char*)(doc["pass"] | "")));
    Serial.println("{\"resp\":\"set_mqtt\",\"ok\":true}");
  } else if (cmd == "set_sensors") {
    saveSensors(String((const char*)(doc["sensors"] | "")));
    Serial.println("{\"resp\":\"set_sensors\",\"ok\":true}");
  } else if (cmd == "set_pins") {
    // Config des pins (JSON imbriqué) -> persistée en NVS. Effet au reboot.
    String pinsJson;
    serializeJson(doc["pins"], pinsJson);
    savePinConfig(pinsJson);
    Serial.println("{\"resp\":\"set_pins\",\"ok\":true}");
  } else if (cmd == "read") {
    // Lecture LIVE des capteurs actifs (test depuis la page web).
    sensor.poll();
    SensorMeasure measures[MAX_MEASURES];
    const int n = sensor.read(measures, MAX_MEASURES);
    DynamicJsonDocument r(512);
    r["resp"] = "read";
    JsonArray arr = r.createNestedArray("measures");
    for (int i = 0; i < n; i++) {
      JsonObject o = arr.createNestedObject();
      o["type"] = measures[i].type;
      o["value"] = measures[i].value;
    }
    serializeJson(r, Serial);
    Serial.println();
  } else if (cmd == "restart") {
    Serial.println("{\"resp\":\"restart\",\"ok\":true}");
    delay(100);
    ESP.restart();
  }
}
