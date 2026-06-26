#ifdef ENABLE_MLX90614
#include "Mlx90614Driver.hpp"
#include <Arduino.h>
#include <Adafruit_MLX90614.h>

static Adafruit_MLX90614 mlx;

void Mlx90614Driver::begin() {
  ok = mlx.begin();
  if (!ok) Serial.println("[MLX90614] capteur introuvable (I2C)");
}

int Mlx90614Driver::read(SensorMeasure* out, int maxOut) {
  if (!ok || maxOut < 1) return 0;
  float t = mlx.readObjectTempC(); // température de l'objet (corps)
  if (isnan(t)) return 0;
  out[0] = {"body_temperature", t};
  return 1;
}
#endif
