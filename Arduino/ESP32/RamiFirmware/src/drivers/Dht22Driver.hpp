#ifndef DHT22_DRIVER_HPP
#define DHT22_DRIVER_HPP

// Compilé uniquement si le capteur est sélectionné au build (variante B slim).
#ifdef ENABLE_DHT22

#include "ISensor.hpp"

// Broche data du DHT22 — surchargeable au build : -D DHT22_PIN=27
#ifndef DHT22_PIN
#define DHT22_PIN 27
#endif

class Dht22Driver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
};

#endif // ENABLE_DHT22
#endif // DHT22_DRIVER_HPP
