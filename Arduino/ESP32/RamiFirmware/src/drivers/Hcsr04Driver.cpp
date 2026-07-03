#ifdef ENABLE_HCSR04
#include "Hcsr04Driver.hpp"
#include <Arduino.h>
#include "PinConfig.hpp"

void Hcsr04Driver::begin() {
  trigPin = getConfiguredPin("hcsr04", "trig", HCSR04_TRIG_PIN);
  echoPin = getConfiguredPin("hcsr04", "echo", HCSR04_ECHO_PIN);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  digitalWrite(trigPin, LOW);
}

int Hcsr04Driver::read(SensorMeasure* out, int maxOut) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  unsigned long duration = pulseIn(echoPin, HIGH, HCSR04_ECHO_TIMEOUT_US);
  if (duration == 0) {
    Serial.println("[HC-SR04] pas d'echo (hors portee)");
    return 0;
  }
  if (maxOut < 1) return 0;
  float distance = (duration * 0.0343f) / 2.0f;
  out[0] = {"distance", distance};
  return 1;
}
#endif
