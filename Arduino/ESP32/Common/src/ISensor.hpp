#ifndef ISENSOR_HPP
#define ISENSOR_HPP

// Interface de capteur (cf. docs/FIRMWARE_ARCHITECTURE.md).
//
// Objectif : séparer l'ACQUISITION (spécifique au capteur) de la PUBLICATION
// (commune, gérée par SensorRunner). Ajouter un capteur = écrire une classe qui
// implémente ISensor, sans toucher au réseau/MQTT/loop.

// Une mesure produite par un capteur : type (ex. "temperature") + valeur.
struct SensorMeasure {
  const char* type;
  float value;
};

class ISensor {
public:
  // Initialisation matérielle (pins, lib, bus). Appelée une fois au setup().
  virtual void begin() = 0;

  // Optionnel : à appeler à chaque itération pour les capteurs qui doivent
  // dépiler un buffer (UART/FIFO, ex. radar mmWave, MAX30102). No-op par défaut.
  virtual void poll() {}

  // Remplit out[] (au plus maxOut mesures) et renvoie le nombre de mesures
  // valides (0 si la lecture a échoué). Ne publie RIEN : c'est le SensorRunner
  // qui publie.
  virtual int read(SensorMeasure* out, int maxOut) = 0;

  virtual ~ISensor() {}
};

#endif // ISENSOR_HPP
