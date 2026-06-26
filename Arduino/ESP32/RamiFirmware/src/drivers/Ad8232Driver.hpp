#ifndef AD8232_DRIVER_HPP
#define AD8232_DRIVER_HPP

#ifdef ENABLE_AD8232

#include "ISensor.hpp"

// Broches AD8232 (ECG analogique) — surchargeables au build.
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
};

#endif // ENABLE_AD8232
#endif // AD8232_DRIVER_HPP
