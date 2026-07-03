#ifdef ENABLE_PIR
#include "PirDriver.hpp"
#include <Arduino.h>
#include "PinConfig.hpp"

void PirDriver::begin() {
  pirPin = getConfiguredPin("pir", "pin", PIR_PIN);
  pinMode(pirPin, INPUT);
}

int PirDriver::read(SensorMeasure* out, int maxOut) {
  if (maxOut < 1) return 0;
  out[0] = {"occupancy", digitalRead(pirPin) == HIGH ? 1.0f : 0.0f};
  return 1;
}
#endif
