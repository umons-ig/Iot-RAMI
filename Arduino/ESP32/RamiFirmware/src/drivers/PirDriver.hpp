#ifndef PIR_DRIVER_HPP
#define PIR_DRIVER_HPP
#ifdef ENABLE_PIR
#include "ISensor.hpp"
#ifndef PIR_PIN
#define PIR_PIN 27
#endif
class PirDriver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
private:
  int pirPin = PIR_PIN;
};
#endif
#endif
