#include <Arduino.h>
#include <Preferences.h>
#include "MQTTCommonOperations.hpp"
#include <WiFiManager.h>
#include <esp_task_wdt.h>
#include <HTTPUpdate.h>

// Watchdog matériel : si loop() se fige (NTP, reconnexion, lib bloquante) plus
// longtemps que ce délai, l'ESP32 redémarre au lieu de rester zombie. §2 revue.
static const int WDT_TIMEOUT_S = 15;
// Throttle de la reconnexion WiFi.
static unsigned long previousWifiCheckMillis = 0;

/****** 
 * Usage of PROGMEM
 * -----------------
 * PROGMEM is used to store variables in flash memory (program memory) instead of SRAM. 
 * This is particularly useful on microcontrollers with limited SRAM.
 * To decide whether a string should be stored in PROGMEM, we consider its length and its access frequency.
 * - If the string is long and accessed rarely, it should be stored in PROGMEM.
 * - Else, it should remain in SRAM for performance reasons.
 ******/

// ----------------------------------- PART COMMON TO ALL MICROCONTROLLERS ---------------------------------------------------
// For example, the different microcontrollers are all capable of understanding the same commands and launching the same type of answers
// That's because they all speak the same language (if this change, update this part...)

/****** Commands; NO PROGREM HERE, because we want the microcontroller to respond quickly to commands
(those are frequently compared to what we received from the servor)*******/
const char* COMMAND_PING = "ping";
const char* COMMAND_START = "start";
const char* COMMAND_STOP = "stop";
const char* COMMAND_ACK = "ack";
// possible answers
const char* PING_RESPONSE = "pong";
const char* PING_RESPONSE_WHEN_ALREADY_PUBLISHING = "pong.publishing";
const char* START_RESPONSE = "start.publishing";
const char* STOP_RESPONSE = "stop.publishing";
// type of the message
const char* MSG_TIMESTAMP = "timestamp";
const char* MSG_CMD = "cmd";
const char* MSG_ANS = "ans";
const char* MSG_VALUE = "value";
const char* MSG_MEASURE = "measures";



/****** NTP Client Settings; PROGREM because these settings are configured only once at the beginning *******/
const char* NTP_SERVER PROGMEM = "pool.ntp.org";
// Epoch UTC strict : aucun décalage horaire ne doit entrer dans un timestamp
// epoch. Le DAYLIGHT_OFFSET_SEC=3600 précédent décalait TOUTES les mesures d'1 h
// (datation médicale faussée). Cf. revue MQTT §2.
const long GMT_OFFSET_SEC = 0;
const int DAYLIGHT_OFFSET_SEC = 0;

WiFiManager wm;
WiFiManagerParameter broker("broker", "MQTT Broker IP", "192.168.10.4", 40);
WiFiManagerParameter username("mqtt_user", "MQTT User", "fog1", 40);
WiFiManagerParameter password("mqtt_password", "MQTT Password", "fog1password", 40);
WiFiManagerParameter sensor_name("sensor_name", "MQTT Sensor Name", "esp32-bmp280", 40);
// Sélection des capteurs au runtime (variante A) : liste CSV éditée au portail.
WiFiManagerParameter sensors_param("sensors", "Capteurs (csv: dht22,bh1750,sgp30)", "", 120);
Preferences preference;
bool shouldSaveConfig = false;
char saved_broker[40];
char saved_username[40];
char saved_password[40];
char saved_name[40];
char saved_topic[50];
char saved_topic_sensor[60];
char saved_topic_server[60];
char saved_sensors[120];

/************************************ Function Implementations *************************************/
void setup_wifi() {
    // Hold BOOT button (GPIO 0) at startup to reset WiFi credentials and force portal
    pinMode(0, INPUT_PULLUP);
    if (digitalRead(0) == LOW) {
        Serial.println("BOOT button held — reset WiFi credentials");
        wm.resetSettings();
    }

    wm.setSaveConfigCallback([]() {
          shouldSaveConfig = true;
    });
    wm.addParameter(&broker);
    wm.addParameter(&username);
    wm.addParameter(&password);
    wm.addParameter(&sensor_name);
    wm.addParameter(&sensors_param);


    preference.begin("fog",true);
    preference.getString("broker", saved_broker,40);
    preference.getString("username", saved_username,40);
    preference.getString("password", saved_password,40);
    preference.getString("sensor_name", saved_name,40);
    preference.getString("sensors", saved_sensors,120);
    preference.end();

    Serial.println(saved_broker);
    Serial.println(saved_username);
    Serial.println(saved_password);
    Serial.println(saved_name);
    snprintf(saved_topic, 60, "%s-topic", saved_name);
    snprintf(saved_topic_server, 60, "%s-topic/server", saved_name);
    snprintf(saved_topic_sensor, 60, "%s-topic/sensor", saved_name);

    // Portail NON bloquant : loop() doit tourner (console série USB + wm.process)
    // même sans WiFi configuré. Sinon, après un flash (qui efface la NVS),
    // l'ESP resterait bloqué dans le portail et la console ne répondrait jamais
    // -> impossible de configurer le WiFi depuis la page web. wm.process() (dans
    // processWifiManager) sert le portail à chaque itération.
    // Piège WiFiManager : autoConnect() BLOQUE dans le portail malgré
    // setConfigPortalBlocking(false). On empêche donc autoConnect de lancer le
    // portail (setEnableConfigPortal(false)) -> il tente juste les creds et rend
    // la main vite ; en cas d'échec on démarre le portail NOUS-MÊMES en non
    // bloquant (startConfigPortal le respecte vraiment) -> loop() tourne et la
    // console série répond.
    wm.setConfigPortalBlocking(false);
    wm.setEnableConfigPortal(false);
    if (wm.autoConnect()) {
        if (shouldSaveConfig) {
            preference.begin("fog", false);
            preference.putString("broker", broker.getValue());
            preference.putString("username", username.getValue());
            preference.putString("password", password.getValue());
            preference.putString("sensor_name", sensor_name.getValue());
            preference.putString("sensors", sensors_param.getValue());
            preference.end();
            ESP.restart();
        }
        Serial.println("Connecté");
        Serial.println(WiFi.localIP());
        wm.startWebPortal(); // page de config accessible à http://<esp32-ip>/
    } else {
        Serial.println("[WiFi] non connecté — portail de config (non bloquant)");
        wm.startConfigPortal("RAMI-Setup"); // non bloquant -> rend la main
    }
    // Reconnexion WiFi auto + watchdog matériel, armés dans TOUS les cas (le
    // watchdog est nourri par processWifiManager à chaque loop). API portable.
    WiFi.setAutoReconnect(true);
#if ESP_IDF_VERSION_MAJOR >= 5
    esp_task_wdt_config_t wdtConfig = {};
    wdtConfig.timeout_ms = WDT_TIMEOUT_S * 1000;
    wdtConfig.idle_core_mask = 0;
    wdtConfig.trigger_panic = true;
    esp_task_wdt_init(&wdtConfig);
#else
    esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif
    esp_task_wdt_add(NULL);
}

void loadSavedSensorsFromNVS() {
  preference.begin("fog", true);
  preference.getString("sensors", saved_sensors, 120);
  preference.end();
}

void processWifiManager() {
    // Nourrit le watchdog à chaque itération de loop() (appelé par tous les sketches).
    esp_task_wdt_reset();
    wm.process();
    // Reconnexion WiFi proactive (throttle 5 s) : WiFiManager en web portal ne
    // relance pas la STA tout seul ; sans ça MQTT tentait de se reconnecter sur
    // une stack sans IP. §2 revue.
    if (WiFi.status() != WL_CONNECTED) {
        unsigned long now = millis();
        if (now - previousWifiCheckMillis >= 5000) {
            previousWifiCheckMillis = now;
            Serial.println("[WiFi] Déconnecté — tentative de reconnexion...");
            WiFi.reconnect();
        }
    }
    if (shouldSaveConfig) {
        shouldSaveConfig = false;
        preference.begin("fog", false);
        preference.putString("broker", broker.getValue());
        preference.putString("username", username.getValue());
        preference.putString("password", password.getValue());
        preference.putString("sensor_name", sensor_name.getValue());
        preference.putString("sensors", sensors_param.getValue());
        preference.end();
        ESP.restart();
    }
}

void setCACertForTLS(WiFiClientSecure& client, const char* certificate) {
    client.setCACert(certificate);
}

void performOta(const String& url) {
    if (url.length() == 0) return;
    Serial.print("[OTA] mise a jour depuis ");
    Serial.println(url);
    // httpUpdate.update() est BLOQUANT (download ~1 Mo) et peut dépasser le délai
    // du watchdog (15 s) sur lien lent -> reset en plein flash. On retire la tâche
    // du watchdog le temps de l'OTA (cf. audit §F5). Sur échec, on la ré-arme.
    esp_task_wdt_delete(NULL);
    WiFiClient otaClient;
    httpUpdate.rebootOnUpdate(true); // reboot automatique après flash réussi
    t_httpUpdate_return ret = httpUpdate.update(otaClient, url);
    switch (ret) {
        case HTTP_UPDATE_FAILED:
            Serial.printf("[OTA] echec (%d): %s\n", httpUpdate.getLastError(),
                          httpUpdate.getLastErrorString().c_str());
            break;
        case HTTP_UPDATE_NO_UPDATES:
            Serial.println("[OTA] aucune mise a jour");
            break;
        case HTTP_UPDATE_OK:
            Serial.println("[OTA] succes (reboot)");
            break;
    }
    esp_task_wdt_add(NULL); // ré-arme le watchdog (cas échec/no-update : pas de reboot)
}

void saveMqttCreds(const String& broker, const String& user, const String& pass) {
    preference.begin("fog", false);
    if (broker.length()) preference.putString("broker", broker);
    if (user.length()) preference.putString("username", user);
    if (pass.length()) preference.putString("password", pass);
    preference.end();
}

void saveWifiCreds(const String& ssid, const String& pass) {
    if (ssid.length() == 0) return;
    // WiFi.begin persistant : l'ESP mémorise les identifiants -> wm.autoConnect()
    // les réutilise au prochain démarrage.
    WiFi.persistent(true);
    WiFi.begin(ssid.c_str(), pass.c_str());
}

void saveSensors(const String& csv) {
    preference.begin("fog", false);
    preference.putString("sensors", csv);
    preference.end();
    // Met aussi à jour la valeur en mémoire -> 'info' la reflète tout de suite
    // (l'activation réelle des capteurs se fait au reboot).
    strncpy(saved_sensors, csv.c_str(), sizeof(saved_sensors) - 1);
    saved_sensors[sizeof(saved_sensors) - 1] = '\0';
}

void saveDeviceName(const String& name) {
    if (name.length() == 0) return;
    preference.begin("fog", false);
    preference.putString("sensor_name", name);
    preference.end();
    strncpy(saved_name, name.c_str(), sizeof(saved_name) - 1);
    saved_name[sizeof(saved_name) - 1] = '\0';
}

static unsigned long previousReconnectMillis = 0;

void reconnect(PubSubClient& client, const char* mqtt_username, const char* mqtt_password, const char* topic) {
    if (client.connected()) return;
    unsigned long currentMillis = millis();
    if (currentMillis - previousReconnectMillis < 5000) return;
    previousReconnectMillis = currentMillis;

    Serial.print("Attempting MQTT connection...");
    // Buffer PubSubClient porté à 512 o pour TOUS les capteurs (défaut 256 o) :
    // au-delà, publish() abandonne en silence (multi-mesures / batch). Centralisé
    // ici pour ne plus dépendre d'un setBufferSize par sketch. Cf. revue MQTT §4.
    // 1024 o : un paquet multi-capteurs (jusqu'à 12 mesures) dépasse 512 o et
    // serait abandonné en silence par publish() (cf. audit §F1).
    client.setBufferSize(1024);
    String clientId = "RAM1-Sensor-";
    clientId += WiFi.macAddress();
    if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
        Serial.println("connected");
        client.subscribe(topic); // subscribe the topics here
    } else {
        Serial.print("failed, rc=");
        Serial.print(client.state());
        Serial.println(" try again in 5 seconds");
    }
}

void publishJSONMessage(PubSubClient& client, const char* topic, const char* json_buffer, const bool& retained) {
    if (!client.publish(topic, json_buffer, retained)) {
        // publish() renvoie false si le paquet dépasse le buffer (256/512 o) ou
        // si la connexion est tombée : on le SIGNALE au lieu d'abandonner en
        // silence (cf. revue MQTT §4).
        Serial.print("!!!! [MQTT] publish ECHOUE (paquet trop gros ou deconnecte) sur ");
        Serial.println(topic);
    }
}

long long getCurrentMicrosecondTimestampLong() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        Serial.println("Failed to obtain time");
        return -1;
    }

    time_t now;
    time(&now);
    long us = micros() % 1000000;
    long long timestamp = static_cast<long long>(now) * 1000000LL + us;

    return timestamp;
}

void publishAnswerToServerCommand(PubSubClient& client, const char* topic, const String& answer, const bool& retained) {
    long long timestamp_buffer = getCurrentMicrosecondTimestampLong();
    if (timestamp_buffer < 0) {
        return;
    }

    DynamicJsonDocument doc(1024);
    doc[MSG_TIMESTAMP] = timestamp_buffer;
    doc[MSG_ANS] = answer;

    char json_buffer[512];
    serializeJson(doc, json_buffer);

    publishJSONMessage(client, topic, json_buffer, retained);
}

void publishValue(PubSubClient& client, const char* topic, const float& value, const bool& retained) {
    long long timestamp_buffer = getCurrentMicrosecondTimestampLong();
    if (timestamp_buffer < 0) {
        return;
    }

    DynamicJsonDocument doc(1024);
    doc[MSG_TIMESTAMP] = timestamp_buffer;
    doc[MSG_VALUE] = value;

    char json_buffer[512];
    serializeJson(doc, json_buffer);

    publishJSONMessage(client, topic, json_buffer, retained);
}
void sendPing(PubSubClient& client, const char* topic,const bool& retained){
        long long timestamp_buffer = getCurrentMicrosecondTimestampLong();
    if (timestamp_buffer < 0) {
        return;
    }

    DynamicJsonDocument doc(1024);
    doc[MSG_TIMESTAMP] = timestamp_buffer;
    doc[MSG_CMD] = COMMAND_PING;

    char json_buffer[512];
    serializeJson(doc, json_buffer);

    publishJSONMessage(client, topic, json_buffer, retained);
}
void sendStart(PubSubClient& client, const char* topic,const bool& retained){
    long long timestamp_buffer = getCurrentMicrosecondTimestampLong();
    if (timestamp_buffer < 0) {
        return;
    }

    DynamicJsonDocument doc(1024);
    doc[MSG_TIMESTAMP] = timestamp_buffer;
    doc[MSG_CMD] = COMMAND_START;

    char json_buffer[512];
    serializeJson(doc, json_buffer);

    publishJSONMessage(client, topic, json_buffer, retained);
}
void sendStop(PubSubClient& client, const char* topic,const bool& retained){
    long long timestamp_buffer = getCurrentMicrosecondTimestampLong();
    if (timestamp_buffer < 0) {
        return;
    }

    DynamicJsonDocument doc(1024);
    doc[MSG_TIMESTAMP] = timestamp_buffer;
    doc[MSG_CMD] = COMMAND_STOP;

    char json_buffer[512];
    serializeJson(doc, json_buffer);

    publishJSONMessage(client, topic, json_buffer, retained);
}

void publishMeasures(PubSubClient& client, const char* topic, const char* measureTypes[], const float measures[],int count, const bool& retained){
    long long timestamp_buffer = getCurrentMicrosecondTimestampLong();
    if (timestamp_buffer < 0) {
        return;
    }
    // Doc dimensionné pour jusqu'à MAX_MEASURES (12) mesures + timestamp.
    DynamicJsonDocument doc(1536);

    JsonArray array = doc.createNestedArray(MSG_MEASURE);  // crée le []

    for (int i = 0; i < count; i++) {
        JsonObject obj = array.createNestedObject();  // ajoute un {} dans le []
        obj["measureType"] = measureTypes[i];
        obj["value"] = measures[i];
    }

    doc[MSG_TIMESTAMP] = timestamp_buffer;

    // Sérialisation DYNAMIQUE (String) : un char[512] tronquait silencieusement
    // au-delà de ~8 mesures (cf. audit §F1). Le buffer PubSubClient est porté à
    // 1024 o dans reconnect() pour transporter le paquet complet.
    String json_buffer;
    serializeJson(doc, json_buffer);

    publishJSONMessage(client, topic, json_buffer.c_str(), retained);
}

void handlePingCommand(PubSubClient& client, const char* topic, const bool& allow_to_publish) {
    if (allow_to_publish) {
        publishAnswerToServerCommand(client, topic, PING_RESPONSE_WHEN_ALREADY_PUBLISHING);
    } else {
        publishAnswerToServerCommand(client, topic, PING_RESPONSE);
    }
}

void handleStartCommand(PubSubClient& client, const char* topic, bool& allow_to_publish) {
    publishAnswerToServerCommand(client, topic, START_RESPONSE);
    allow_to_publish = true;
}

void handleStopCommand(PubSubClient& client, const char* topic, bool& allow_to_publish) {
    allow_to_publish = false;
    publishAnswerToServerCommand(client, topic, STOP_RESPONSE);
}

void interactWithReceivedCommand(PubSubClient& client, const String& received_command, const char* topic, bool& allow_to_publish) {
    Serial.print("Received command: ");
    Serial.println(received_command);
    Serial.print("Current allow_to_publish state: ");
    Serial.println(allow_to_publish ? "true" : "false");

    if (received_command == COMMAND_PING) {
        Serial.println("Handling PING command");
        handlePingCommand(client, topic, allow_to_publish);
    } else if (received_command == COMMAND_START) {
        Serial.println("Handling START command");
        handleStartCommand(client, topic, allow_to_publish);
        Serial.print("New allow_to_publish state: ");
        Serial.println(allow_to_publish ? "true" : "false");
    } else if (received_command == COMMAND_STOP) {
        Serial.println("Handling STOP command");
        handleStopCommand(client, topic, allow_to_publish);
        Serial.print("New allow_to_publish state: ");
        Serial.println(allow_to_publish ? "true" : "false");
    }
}

void interactWithAnswerCommand(PubSubClient& client, const String& received_command, const char* topic, bool& allow_to_publish) {
    Serial.print("Received command: ");
    Serial.println(received_command);
    Serial.print("Current allow_to_publish state: ");
    Serial.println(allow_to_publish ? "true" : "false");
    if (received_command == COMMAND_STOP) {
        Serial.println("Handling STOP command");
        allow_to_publish = false;
        Serial.print("New allow_to_publish state: ");
        Serial.println(allow_to_publish ? "true" : "false");
    } else if (received_command == COMMAND_ACK) {
        Serial.println("Handling HANDSHAKE command");
        allow_to_publish = true;
        Serial.print("New allow_to_publish state: ");
        Serial.println(allow_to_publish ? "true" : "false");
    }
}