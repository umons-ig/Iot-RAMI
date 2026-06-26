#ifndef CONTACT_DRIVER_HPP
#define CONTACT_DRIVER_HPP
#ifdef ENABLE_CONTACT
#include "ISensor.hpp"
#ifndef CONTACT_PIN
#define CONTACT_PIN 26
#endif
class ContactDriver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
private:
  int contactPin = CONTACT_PIN;
};
#endif
#endif
