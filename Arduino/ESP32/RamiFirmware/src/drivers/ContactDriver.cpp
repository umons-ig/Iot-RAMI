#ifdef ENABLE_CONTACT
#include "ContactDriver.hpp"
#include <Arduino.h>

void ContactDriver::begin() { pinMode(CONTACT_PIN, INPUT_PULLUP); }

int ContactDriver::read(SensorMeasure* out, int maxOut) {
  if (maxOut < 1) return 0;
  // Reed fermé -> broche à LOW (vers GND) -> contact=1.
  out[0] = {"contact", digitalRead(CONTACT_PIN) == LOW ? 1.0f : 0.0f};
  return 1;
}
#endif
