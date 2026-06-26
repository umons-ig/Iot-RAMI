#ifdef ENABLE_BH1750
#include "Bh1750Driver.hpp"
#include <Arduino.h>
#include <Wire.h>
#include <BH1750.h>

static BH1750 lightMeter;

void Bh1750Driver::begin() {
  Wire.begin();
  ok = lightMeter.begin();
  if (!ok) Serial.println("[BH1750] capteur introuvable (I2C)");
}

int Bh1750Driver::read(SensorMeasure* out, int maxOut) {
  if (!ok || maxOut < 1) return 0;
  float lux = lightMeter.readLightLevel();
  if (lux < 0) return 0;
  out[0] = {"illuminance", lux};
  return 1;
}
#endif
