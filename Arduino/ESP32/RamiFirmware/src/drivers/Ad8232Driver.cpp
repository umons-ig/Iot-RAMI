#ifdef ENABLE_AD8232
#include "Ad8232Driver.hpp"
#include <Arduino.h>
#include "PinConfig.hpp"

void Ad8232Driver::begin() {
  outPin = getConfiguredPin("ad8232", "out", AD8232_OUT_PIN);
  loPlus = getConfiguredPin("ad8232", "lo_plus", AD8232_LO_PLUS_PIN);
  loMinus = getConfiguredPin("ad8232", "lo_minus", AD8232_LO_MINUS_PIN);
  pinMode(loPlus, INPUT);
  pinMode(loMinus, INPUT);
  pinMode(outPin, INPUT);
}

int Ad8232Driver::read(SensorMeasure* out, int maxOut) {
  if (digitalRead(loPlus) == 1 || digitalRead(loMinus) == 1) return 0;
  if (maxOut < 1) return 0;
  out[0] = {"ecg", (float)analogRead(outPin)};
  return 1;
}
#endif
