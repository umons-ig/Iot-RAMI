#ifndef SGP30_DRIVER_HPP
#define SGP30_DRIVER_HPP
#ifdef ENABLE_SGP30
#include "ISensor.hpp"
// Capteur qualité d'air SGP30 (I2C) -> co2 (eCO2 ppm) + tvoc (ppb).
class Sgp30Driver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
private:
  bool ok = false;
};
#endif
#endif
