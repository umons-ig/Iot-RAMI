#ifndef MQTT_CA_CERT_HPP
#define MQTT_CA_CERT_HPP

/**
 * Certificat de l'autorité qui a signé le certificat du broker MQTT.
 *
 * À REMPLIR avant d'activer RAMI_MQTT_TLS. Un certificat d'AC n'est pas un
 * secret : il a vocation à être committé, contrairement aux clés privées.
 *
 * Pour un Mosquitto avec une AC locale, coller ici le contenu de `ca.crt` :
 *
 *   const char MQTT_CA_CERT[] PROGMEM = R"EOF(
 *   -----BEGIN CERTIFICATE-----
 *   MIID...
 *   -----END CERTIFICATE-----
 *   )EOF";
 *
 * Tant que cette constante reste vide, le firmware REFUSE de se connecter en
 * TLS (fail-closed) : chiffrer sans vérifier à qui l'on parle protégerait de
 * l'écoute passive mais pas de l'usurpation du broker — or c'est précisément
 * l'attaque qui permet de piloter un capteur. Pour un essai sur banc, compiler
 * avec -DRAMI_MQTT_TLS_INSECURE, qui l'autorise explicitement et le signale à
 * chaque démarrage.
 */
const char MQTT_CA_CERT[] PROGMEM = "";

#endif  // MQTT_CA_CERT_HPP
