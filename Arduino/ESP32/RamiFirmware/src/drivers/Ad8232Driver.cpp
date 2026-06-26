#ifdef ENABLE_AD8232

#include "Ad8232Driver.hpp"
#include <Arduino.h>

void Ad8232Driver::begin() {
  pinMode(AD8232_LO_PLUS_PIN, INPUT);   // détection électrode décollée (LO+)
  pinMode(AD8232_LO_MINUS_PIN, INPUT);  // détection électrode décollée (LO-)
  pinMode(AD8232_OUT_PIN, INPUT);
}

int Ad8232Driver::read(SensorMeasure* out, int maxOut) {
  // Électrode décollée -> pas de mesure exploitable.
  if (digitalRead(AD8232_LO_PLUS_PIN) == 1 || digitalRead(AD8232_LO_MINUS_PIN) == 1) {
    return 0;
  }
  if (maxOut < 1) return 0;
  out[0] = {"ecg", (float)analogRead(AD8232_OUT_PIN)};
  return 1;
}

#endif // ENABLE_AD8232
