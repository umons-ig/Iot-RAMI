#include <Arduino.h>
#include "SpecificConstants.hpp"
#include "MQTTCommonOperations.hpp"
#include "Sensor.hpp"

/**** Secure WiFi Connectivity Initialisation *****/
WiFiClient espClient;

/**** MQTT Client Initialisation Using WiFi Connection *****/
PubSubClient client(espClient);

/**** Callback : réaction aux messages MQTT reçus depuis le serveur ****/
void callback(char *topic, byte *payload, unsigned int length) {
    Serial.print("Message arrived in topic: ");
    Serial.println(topic);

    String received_message;
    for (int i = 0; i < length; i++) {
        Serial.print((char) payload[i]);
        received_message += (char)payload[i];
    }
    Serial.println();

    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, received_message);
    if (error) {
        Serial.print("deserializeJson() failed: ");
        Serial.println(error.c_str());
        return;
    }
    if (doc.containsKey(MSG_CMD)) {
        String received_command = doc[MSG_CMD];
        interactWithReceivedCommand(client, received_command, saved_topic_sensor, allow_to_publish);
    } else if (doc.containsKey(MSG_ANS)) {
        String received_answer = doc[MSG_ANS];
        interactWithAnswerCommand(client, received_answer, saved_topic_sensor, allow_to_publish);
    }
}

/**** MAIN PROGRAM ****/

void setup() {
    Serial.begin(115200);
    // ESP32-C6 USB-CDC : attendre que le port soit ouvert avant d'imprimer
    while (!Serial) delay(10);
    setup_wifi();

    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    setupSensor();

    client.setServer(saved_broker, MQTT_PORT);
    client.setBufferSize(512);
    client.setCallback(callback);
}

unsigned long previousPingMillis  = 0;
unsigned long previousStartMillis = 0;
const long PING_INTERVAL  = 20000;
const long START_INTERVAL = 30000;

void loop() {
    if (!client.connected()) {
        reconnect(client, saved_username, saved_password, saved_topic_server);
        if (client.connected()) {
            sendPing(client, saved_topic_sensor);
            sendStart(client, saved_topic_sensor);
            previousPingMillis  = millis();
            previousStartMillis = millis();
        }
    }
    client.loop();
    processWifiManager();

    // ⚠️  DIFFÉRENCE AVEC HCSR04 : updateSensor() doit être appelé à chaque
    // itération pour vider le buffer UART du capteur mmWave.
    // Il est indépendant du flag allow_to_publish et de l'intervalle INTERVAL.
    updateSensor();

    unsigned long currentMillis = millis();

    if (!allow_to_publish && currentMillis - previousStartMillis >= START_INTERVAL) {
        previousStartMillis = millis();
        sendStart(client, saved_topic_sensor);
    }

    if (currentMillis - previousPingMillis >= PING_INTERVAL) {
        previousPingMillis = currentMillis;
        sendPing(client, saved_topic_sensor);
    }

    if (currentMillis - previousMillis >= INTERVAL) {
        previousMillis = currentMillis;
        if (allow_to_publish) {
            readAndPublishMeasures(client, saved_topic_sensor);
        }
    }
}
