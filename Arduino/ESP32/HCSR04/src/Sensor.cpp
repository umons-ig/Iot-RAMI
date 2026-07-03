#include <Arduino.h>
#include "Sensor.hpp"
#include "MQTTCommonOperations.hpp"

void setupSensor() {
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    // Ensure TRIG starts LOW
    digitalWrite(TRIG_PIN, LOW);
}

void readAndPublishMeasures(PubSubClient& client, const char* topic) {
    // --- Trigger a fresh ultrasonic burst ---
    // The HC-SR04 requires a clean LOW before the HIGH pulse to avoid spurious readings
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    // --- Measure ECHO pulse duration ---
    // pulseIn returns 0 if no echo arrives within ECHO_TIMEOUT_US (obstacle out of range)
    unsigned long duration = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);

    if (duration == 0) {
        // No echo received: obstacle out of range or sensor error — skip publication
        Serial.println("HC-SR04: no echo received (out of range or sensor error)");
        return;
    }

    // --- Convert duration to distance ---
    // Sound speed in air ≈ 343 m/s = 0.0343 cm/µs
    // The pulse travels to the obstacle AND back, hence we divide by 2
    float distance = (duration * 0.0343f) / 2.0f;

    const char* types[]  = {"distance"};
    const float values[] = {distance};
    publishMeasures(client, topic, types, values, 1);
}
