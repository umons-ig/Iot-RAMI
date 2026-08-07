#ifndef MQTT_TRANSPORT_HPP
#define MQTT_TRANSPORT_HPP

#include <Client.h>

/**
 * Couche transport du client MQTT : en clair (défaut) ou sur TLS.
 *
 * Le choix est fait à la COMPILATION, via -D RAMI_MQTT_TLS. Deux raisons de ne
 * pas le rendre configurable au runtime : WiFiClientSecure réserve plusieurs
 * dizaines de kilo-octets de RAM pour ses tampons TLS, qu'il serait dommage
 * d'immobiliser sur un ESP qui n'en a pas l'usage ; et une bascule accidentelle
 * en clair via le portail de configuration passerait inaperçue.
 *
 * Sans le flag, le comportement est STRICTEMENT celui d'avant : WiFiClient nu,
 * port 1883. Les capteurs déjà déployés ne changent pas.
 *
 * Avec le flag :
 *   - le port par défaut passe à 8883 (surchargeable par -D MQTT_PORT) ;
 *   - le certificat de MqttCaCert.hpp est exigé, sauf -D RAMI_MQTT_TLS_INSECURE.
 */

/** Port MQTT par défaut, cohérent avec le mode de transport compilé. */
#ifndef MQTT_PORT
#ifdef RAMI_MQTT_TLS
#define MQTT_PORT 8883
#else
#define MQTT_PORT 1883
#endif
#endif

/**
 * Renvoie le client de transport, à confier à PubSubClient.
 *
 * Sans effet de bord : peut donc être appelée pendant l'initialisation des
 * variables globales, avant que Serial ne soit prêt.
 */
Client& mqttTransport();

/**
 * Configure le transport (charge l'AC en mode TLS) et journalise le résultat.
 *
 * À appeler depuis setup(), APRÈS Serial.begin() et AVANT la première
 * connexion — sinon les diagnostics TLS partent dans le vide. Renvoie false si
 * le TLS est demandé sans certificat d'AC ni opt-in explicite.
 */
bool setupMqttTransport();

/** Faux si le TLS est demandé mais mal configuré (AC absente sans opt-in). */
bool isMqttTransportReady();

/** "TLS" ou "clair" — pour les logs de démarrage et la console série. */
const char* mqttTransportName();

#endif  // MQTT_TRANSPORT_HPP
