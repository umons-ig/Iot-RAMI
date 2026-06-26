#ifndef HCSR04_DRIVER_HPP
#define HCSR04_DRIVER_HPP

#ifdef ENABLE_HCSR04

#include "ISensor.hpp"

#ifndef HCSR04_TRIG_PIN
#define HCSR04_TRIG_PIN 22
#endif
#ifndef HCSR04_ECHO_PIN
#define HCSR04_ECHO_PIN 23
#endif
// Timeout écho ~30 ms ≈ 5 m de portée.
#ifndef HCSR04_ECHO_TIMEOUT_US
#define HCSR04_ECHO_TIMEOUT_US 30000
#endif

class Hcsr04Driver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
};

#endif // ENABLE_HCSR04
#endif // HCSR04_DRIVER_HPP
