#ifdef ENABLE_GSR
#include "GsrDriver.hpp"
#include <Arduino.h>
#include "PinConfig.hpp"

void GsrDriver::begin() {
  gsrPin = getConfiguredPin("gsr", "pin", GSR_PIN);
  pinMode(gsrPin, INPUT);
}

int GsrDriver::read(SensorMeasure* out, int maxOut) {
  if (maxOut < 1) return 0;
  out[0] = {"gsr", (float)analogRead(gsrPin)};
  return 1;
}
#endif
