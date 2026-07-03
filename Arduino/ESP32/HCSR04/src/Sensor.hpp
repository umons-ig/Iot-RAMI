#ifndef SENSOR
#define SENSOR

#include <PubSubClient.h>

// HC-SR04 pin definitions
// TRIG: output — triggers the ultrasonic pulse (active HIGH for 10µs)
// ECHO: input  — stays HIGH for the duration proportional to the measured distance
#define TRIG_PIN 22
#define ECHO_PIN 23

// Maximum echo timeout: 30 000 µs ≈ 5 m range
// Beyond this the sensor returns 0 (no echo received)
#define ECHO_TIMEOUT_US 30000

void readAndPublishMeasures(PubSubClient& client, const char* topic);
void setupSensor();

#endif // SENSOR
