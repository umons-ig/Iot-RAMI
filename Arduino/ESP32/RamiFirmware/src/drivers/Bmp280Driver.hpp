#ifndef BMP280_DRIVER_HPP
#define BMP280_DRIVER_HPP

#ifdef ENABLE_BMP280

#include "ISensor.hpp"

// Adresse I2C du BMP280 — surchargeable au build : -D BMP280_ADDR=0x77
#ifndef BMP280_ADDR
#define BMP280_ADDR 0x76
#endif

class Bmp280Driver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;

private:
  bool ok = false;
};

#endif // ENABLE_BMP280
#endif // BMP280_DRIVER_HPP
