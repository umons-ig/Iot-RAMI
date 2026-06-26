#ifndef PIR_DRIVER_HPP
#define PIR_DRIVER_HPP
#ifdef ENABLE_PIR
#include "ISensor.hpp"
#ifndef PIR_PIN
#define PIR_PIN 27
#endif
// Détecteur de mouvement PIR (HC-SR501) -> occupancy (0/1).
class PirDriver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
};
#endif
#endif
