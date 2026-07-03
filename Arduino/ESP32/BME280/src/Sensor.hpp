#ifndef SENSOR
#define SENSOR

#include <Wire.h>

#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <PubSubClient.h>



#define SEALEVELPRESSURE_HPA 1013.25

void readAndPublishMeasures(PubSubClient& client, const char* topic);
void setupSensor();

#endif
