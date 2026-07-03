#ifndef GSR_DRIVER_HPP
#define GSR_DRIVER_HPP
#ifdef ENABLE_GSR
#include "ISensor.hpp"
#ifndef GSR_PIN
#define GSR_PIN 34
#endif
class GsrDriver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
private:
  int gsrPin = GSR_PIN;
};
#endif
#endif
