#ifndef AD8232_DRIVER_HPP
#define AD8232_DRIVER_HPP
#ifdef ENABLE_AD8232
#include "ISensor.hpp"
#ifndef AD8232_OUT_PIN
#define AD8232_OUT_PIN 14
#endif
#ifndef AD8232_LO_PLUS_PIN
#define AD8232_LO_PLUS_PIN 13
#endif
#ifndef AD8232_LO_MINUS_PIN
#define AD8232_LO_MINUS_PIN 12
#endif
class Ad8232Driver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
private:
  int outPin = AD8232_OUT_PIN;
  int loPlus = AD8232_LO_PLUS_PIN;
  int loMinus = AD8232_LO_MINUS_PIN;
};
#endif
#endif
