#ifdef ENABLE_DHT22

#include "Dht22Driver.hpp"
#include <Arduino.h>
#include <DHT.h>
#include "PinConfig.hpp"

#define DHT22_TYPE DHT22
static DHT* dht = nullptr;

void Dht22Driver::begin() {
  int dataPin = getConfiguredPin("dht22", "data", DHT22_PIN);
  dht = new DHT(dataPin, DHT22_TYPE);
  dht->begin();
}

int Dht22Driver::read(SensorMeasure* out, int maxOut) {
  if (!dht) return 0;
  float humidity = dht->readHumidity();
  float temperature = dht->readTemperature();
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
