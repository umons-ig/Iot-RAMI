#ifdef ENABLE_HCSR04

#include "Hcsr04Driver.hpp"
#include <Arduino.h>

void Hcsr04Driver::begin() {
  pinMode(HCSR04_TRIG_PIN, OUTPUT);
  pinMode(HCSR04_ECHO_PIN, INPUT);
  digitalWrite(HCSR04_TRIG_PIN, LOW);
}

int Hcsr04Driver::read(SensorMeasure* out, int maxOut) {
  // Impulsion ultrason (LOW propre puis 10 µs HIGH).
  digitalWrite(HCSR04_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(HCSR04_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(HCSR04_TRIG_PIN, LOW);

  unsigned long duration = pulseIn(HCSR04_ECHO_PIN, HIGH, HCSR04_ECHO_TIMEOUT_US);
  if (duration == 0) {
    Serial.println("[HC-SR04] pas d'echo (hors portee)");
    return 0;
  }
  if (maxOut < 1) return 0;
  // 0.0343 cm/µs, aller-retour -> /2.
  float distance = (duration * 0.0343f) / 2.0f;
  out[0] = {"distance", distance};
  return 1;
}

#endif // ENABLE_HCSR04
