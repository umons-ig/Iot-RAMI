#ifndef PIN_CONFIG_HPP
#define PIN_CONFIG_HPP

#include <Arduino.h>

// Configuration des pins par capteur, persistée en NVS au format JSON
// (ex. {"dht22":{"data":15},"hcsr04":{"trig":22,"echo":23}}), éditable depuis la
// page web (console série). Permet de câbler les capteurs sur n'importe quels
// GPIO sans recompiler. Si une pin n'est pas configurée -> valeur par défaut.

void loadPinConfig();                    // charge la config NVS en mémoire
void savePinConfig(const String& json);  // persiste en NVS + recharge
String getPinConfigJson();               // JSON courant (pour la commande info)
// Résout la pin d'un capteur/rôle, avec repli sur la valeur par défaut.
int getConfiguredPin(const char* sensor, const char* role, int defaultPin);

#endif // PIN_CONFIG_HPP
