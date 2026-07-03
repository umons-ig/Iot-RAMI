#ifdef ENABLE_BMP280

#include "Bmp280Driver.hpp"
#include <Arduino.h>
#include <Adafruit_BMP280.h>

static Adafruit_BMP280 bmp;

void Bmp280Driver::begin() {
  ok = bmp.begin(BMP280_ADDR);
  if (!ok) {
    Serial.println("[BMP280] capteur introuvable — verifier le cablage I2C");
  }
}

int Bmp280Driver::read(SensorMeasure* out, int maxOut) {
  if (!ok) return 0;
  float temperature = bmp.readTemperature();
  float pressure = bmp.readPressure() / 100.0f; // Pa -> hPa
  if (isnan(temperature) || isnan(pressure)) {
    Serial.println("[BMP280] lecture echouee");
    return 0;
  }
  int n = 0;
  if (n < maxOut) out[n++] = {"temperature", temperature};
  if (n < maxOut) out[n++] = {"pressure", pressure};
  return n;
}

#endif // ENABLE_BMP280
