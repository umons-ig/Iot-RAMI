#ifdef ENABLE_PIR
#include "PirDriver.hpp"
#include <Arduino.h>

void PirDriver::begin() { pinMode(PIR_PIN, INPUT); }

int PirDriver::read(SensorMeasure* out, int maxOut) {
  if (maxOut < 1) return 0;
  out[0] = {"occupancy", digitalRead(PIR_PIN) == HIGH ? 1.0f : 0.0f};
  return 1;
}
#endif
