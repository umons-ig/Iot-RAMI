#include "MqttTransport.hpp"

#include <Arduino.h>

static bool transportReady = false;

#ifdef RAMI_MQTT_TLS
#include <WiFiClientSecure.h>

#include "MqttCaCert.hpp"

static WiFiClientSecure secureClient;

Client& mqttTransport() { return secureClient; }

bool setupMqttTransport() {
    if (strlen_P(MQTT_CA_CERT) > 0) {
        secureClient.setCACert(MQTT_CA_CERT);
        transportReady = true;
        Serial.println("[MQTT] TLS actif, certificat du broker verifie");
        return true;
    }

#ifdef RAMI_MQTT_TLS_INSECURE
    // Opt-in explicite, réservé au banc de test : le trafic est chiffré, mais
    // l'identité du broker n'est PAS vérifiée — un broker usurpé serait accepté
    // et pourrait piloter ce capteur.
    secureClient.setInsecure();
    transportReady = true;
    Serial.println("[MQTT] ATTENTION : TLS SANS verification du certificat "
                   "(RAMI_MQTT_TLS_INSECURE). Ne pas utiliser en service.");
    return true;
#else
    transportReady = false;
    Serial.println("[MQTT] ERREUR : RAMI_MQTT_TLS est actif mais MQTT_CA_CERT "
                   "est vide. Renseignez Common/src/MqttCaCert.hpp, ou "
                   "compilez avec -DRAMI_MQTT_TLS_INSECURE pour un essai.");
    return false;
#endif
}

const char* mqttTransportName() { return "TLS"; }

#else  // ─── Transport historique, en clair ──────────────────────────────────

#include <WiFiClient.h>

static WiFiClient plainClient;

Client& mqttTransport() { return plainClient; }

bool setupMqttTransport() {
    transportReady = true;
    return true;
}

const char* mqttTransportName() { return "clair"; }

#endif

bool isMqttTransportReady() { return transportReady; }
