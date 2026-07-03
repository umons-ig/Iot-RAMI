#ifdef ENABLE_CONTACT
#include "ContactDriver.hpp"
#include <Arduino.h>
#include "PinConfig.hpp"

void ContactDriver::begin() {
  contactPin = getConfiguredPin("contact", "pin", CONTACT_PIN);
  pinMode(contactPin, INPUT_PULLUP);
}

int ContactDriver::read(SensorMeasure* out, int maxOut) {
  if (maxOut < 1) return 0;
  out[0] = {"contact", digitalRead(contactPin) == LOW ? 1.0f : 0.0f};
  return 1;
}
#endif
