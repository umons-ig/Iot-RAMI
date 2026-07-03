#include <Arduino.h>
#include "Sensor.hpp"
#include "MQTTCommonOperations.hpp"

Adafruit_BMP280 bmp;

void setupSensor() {
    bool status;
    status = bmp.begin(0x76);
    if (!status) {
        Serial.println("Could not find a valid BMP280 sensor, check wiring!");
  }

}
void readAndPublishMeasures(PubSubClient& client, const char* topic) {
    float temperature = bmp.readTemperature();
    float pressure = bmp.readPressure()/100;
    if (isnan(pressure) || isnan(temperature)) {
        Serial.println("Failed to read from DHT sensor!");
        return;
    }
    const char* types[] = {"temperature", "pressure"};
    const float values[] = {temperature, pressure};
    publishMeasures(client, topic, types, values, 2);
}
