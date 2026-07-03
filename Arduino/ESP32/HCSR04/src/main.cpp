#include <Arduino.h>
#include "SpecificConstants.hpp"
#include "MQTTCommonOperations.hpp"
#include "Sensor.hpp"

/**** Secure WiFi Connectivity Initialisation *****/
WiFiClient espClient;

/**** MQTT Client Initialisation Using WiFi Connection *****/
PubSubClient client(espClient);

/**** FUNCTIONS *****/
/***** Callback Method, allow the sensor to react when Receiving MQTT messages ****/
void callback(char *topic, byte *payload, unsigned int length) {
    Serial.print("Message arrived in topic: ");
    Serial.println(topic);

    String received_message;
    for (int i = 0; i < length; i++) {
        Serial.print((char) payload[i]);
        received_message += (char)payload[i];
    }
    Serial.println();

    // Parse the received JSON message
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

/**** MAIN PROGRAM *****/

void setup() {
    // Set software serial baud to 115200;
    Serial.begin(115200);
    setup_wifi();
    //setCACertForTLS(espClient, ROOT_CA);      // enable this line and the the "certificate" code for secure connection

    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER); // For timestamp
    setupSensor(); // initialize the sensor
    // Connecting to mqtt broker
    client.setServer(saved_broker, MQTT_PORT);
    client.setCallback(callback); // how to answer to mqtt messages
}


unsigned long previousPingMillis = 0;
unsigned long previousStartMillis = 0;
const long PING_INTERVAL = 20000;
const long START_INTERVAL = 30000;



void loop() {
    if (!client.connected()) {
        reconnect(client, saved_username, saved_password, saved_topic_server);
        if (client.connected()) {
            sendPing(client, saved_topic_sensor);
            sendStart(client, saved_topic_sensor);
            previousPingMillis = millis();
            previousStartMillis = millis();
        }
    }
    client.loop();
    processWifiManager();
    unsigned long currentMillis = millis();
    if (!allow_to_publish && currentMillis - previousStartMillis >= START_INTERVAL){
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
