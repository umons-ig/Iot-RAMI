#ifdef ENABLE_SGP30
#include "Sgp30Driver.hpp"
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_SGP30.h>

static Adafruit_SGP30 sgp;

void Sgp30Driver::begin() {
  ok = sgp.begin();
  if (!ok) Serial.println("[SGP30] capteur introuvable (I2C)");
}

int Sgp30Driver::read(SensorMeasure* out, int maxOut) {
  if (!ok) return 0;
  if (!sgp.IAQmeasure()) {
    Serial.println("[SGP30] mesure echouee");
    return 0;
  }
  int n = 0;
  if (n < maxOut) out[n++] = {"co2", (float)sgp.eCO2};
  if (n < maxOut) out[n++] = {"tvoc", (float)sgp.TVOC};
  return n;
}
#endif
