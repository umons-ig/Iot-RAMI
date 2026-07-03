#ifdef ENABLE_MAX30102
#include "Max30102Driver.hpp"
#include <Arduino.h>
#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"

static MAX30105 particleSensor;

void Max30102Driver::begin() {
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[MAX30102] capteur introuvable (I2C)");
    return;
  }
  // Réglage standard oxymétrie (cf. exemple SparkFun).
  particleSensor.setup(60, 4, 2, 100, 411, 4096);
}

void Max30102Driver::poll() {
  while (particleSensor.available() && filled < WINDOW) {
    redBuffer[filled] = particleSensor.getRed();
    irBuffer[filled] = particleSensor.getIR();
    particleSensor.nextSample();
    filled++;
  }
  particleSensor.check(); // recharge le FIFO
  if (filled >= WINDOW) ready = true;
}

int Max30102Driver::read(SensorMeasure* out, int maxOut) {
  if (!ready) return 0;
  int32_t spo2 = 0, heartRate = 0;
  int8_t spo2Valid = 0, hrValid = 0;
  maxim_heart_rate_and_oxygen_saturation(irBuffer, WINDOW, redBuffer,
                                         &spo2, &spo2Valid, &heartRate, &hrValid);
  // On réarme une nouvelle fenêtre.
  filled = 0;
  ready = false;

  int n = 0;
  if (spo2Valid && n < maxOut) out[n++] = {"spo2", (float)spo2};
  if (hrValid && n < maxOut) out[n++] = {"heart_rate", (float)heartRate};
  return n;
}
#endif
