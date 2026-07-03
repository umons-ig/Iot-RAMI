#ifndef SENSOR
#define SENSOR

#include <PubSubClient.h>

#define pin_lo_plus 13
#define pin_lo_minus 12
#define analog_pin 14

void readAndPublishMeasures(PubSubClient& client, const char* topic);
void setupSensor();

#endif
