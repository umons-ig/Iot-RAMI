#include "Sensor.hpp"
#include "MQTTCommonOperations.hpp"

void setupSensor() {
    pinMode(pin_lo_plus, INPUT); // Setup for leads off detection LO +
    pinMode(pin_lo_minus, INPUT); // Setup for leads off detection LO -
    pinMode(analog_pin, INPUT);
}
void readAndPublishMeasures(PubSubClient& client, const char* topic) {
    if((digitalRead(pin_lo_plus) == 1)||(digitalRead(pin_lo_minus) == 1)){ // Look for any connection problems
        Serial.println('!');
    }else {
    float ecg = analogRead(analog_pin);
    const char* types[] = {"ecg"};
    const float values[] = {ecg};
    publishMeasures(client, topic, types, values, 1);
    }
}
