#ifdef ENABLE_GSR
#include "GsrDriver.hpp"
#include <Arduino.h>

void GsrDriver::begin() { pinMode(GSR_PIN, INPUT); }

int GsrDriver::read(SensorMeasure* out, int maxOut) {
  if (maxOut < 1) return 0;
  out[0] = {"gsr", (float)analogRead(GSR_PIN)};
  return 1;
}
#endif
