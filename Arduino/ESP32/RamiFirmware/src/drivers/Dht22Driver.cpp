#ifdef ENABLE_DHT22

#include "Dht22Driver.hpp"
#include <Arduino.h>
#include <DHT.h>

#define DHT22_TYPE DHT22
static DHT dht(DHT22_PIN, DHT22_TYPE);

void Dht22Driver::begin() {
  dht.begin();
}

int Dht22Driver::read(SensorMeasure* out, int maxOut) {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("[DHT22] lecture echouee");
    return 0;
  }
  int n = 0;
  if (n < maxOut) out[n++] = {"temperature", temperature};
  if (n < maxOut) out[n++] = {"humidity", humidity};
  return n;
}

#endif // ENABLE_DHT22
