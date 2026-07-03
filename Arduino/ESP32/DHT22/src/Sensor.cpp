#include "Sensor.hpp"
#include <Arduino.h>
#include <DHT.h>

#define DHTTYPE DHT22
#define DHTPIN 27

static DHT dht(DHTPIN, DHTTYPE);

void Dht22Sensor::begin() {
  dht.begin();
}

int Dht22Sensor::read(SensorMeasure* out, int maxOut) {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor!");
    return 0;
  }
  int n = 0;
  if (n < maxOut) out[n++] = {"temperature", temperature};
  if (n < maxOut) out[n++] = {"humidity", humidity};
  return n;
}
