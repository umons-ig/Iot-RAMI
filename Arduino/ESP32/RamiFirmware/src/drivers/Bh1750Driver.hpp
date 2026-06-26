#ifndef BH1750_DRIVER_HPP
#define BH1750_DRIVER_HPP
#ifdef ENABLE_BH1750
#include "ISensor.hpp"
// Capteur de luminosité BH1750 (I2C) -> illuminance (lux).
class Bh1750Driver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
private:
  bool ok = false;
};
#endif
#endif
