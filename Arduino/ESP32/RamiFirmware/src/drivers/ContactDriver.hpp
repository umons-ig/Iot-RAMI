#ifndef CONTACT_DRIVER_HPP
#define CONTACT_DRIVER_HPP
#ifdef ENABLE_CONTACT
#include "ISensor.hpp"
#ifndef CONTACT_PIN
#define CONTACT_PIN 26
#endif
// Contact d'ouverture (ILS/reed switch porte/fenêtre) -> contact (1=fermé).
class ContactDriver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
};
#endif
#endif
