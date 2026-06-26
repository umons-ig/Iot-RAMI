#ifndef SENSOR
#define SENSOR

#include "ISensor.hpp"

// Driver DHT22 (température + humidité) implémentant l'interface commune ISensor.
// L'acquisition est isolée du transport : c'est le SensorRunner qui publie.
class Dht22Sensor : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
};

#endif
