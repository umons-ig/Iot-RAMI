#include <Arduino.h>
#include "Sensor.hpp"
#include "MQTTCommonOperations.hpp"

// UART0 utilisé comme dans l'exemple Seeed (pins par défaut ESP32-C6)
HardwareSerial mmWaveSerial(0);
SEEED_MR60BHA2 mmWaveSensor;

void setupSensor() {
    mmWaveSensor.begin(&mmWaveSerial);
    Serial.println("MR60BHA2: capteur initialisé");
}

void updateSensor() {
    // update(100) : attend jusqu'à 100 ms pour recevoir une trame complète,
    // comme dans l'exemple Seeed. Sans timeout le buffer n'a pas le temps de se remplir.
    mmWaveSensor.update(100);
}

void readAndPublishMeasures(PubSubClient& client, const char* topic) {
    if (!mmWaveSensor.isHumanDetected()) {
        Serial.println("MR60BHA2: aucune présence détectée, publication ignorée");
        return;
    }

    float breathingRate = 0.0f;
    float heartRate     = 0.0f;
    float distance      = 0.0f;
    mmWaveSensor.getBreathRate(breathingRate);
    mmWaveSensor.getHeartRate(heartRate);
    mmWaveSensor.getDistance(distance);

    // Position X/Y et nombre de personnes détectées.
    // getPeopleCountingTargetInfo() remplit un vecteur de TargetN (une entrée par personne).
    // On publie la position de la première cible + le total via targets.size().
    float xPosition  = 0.0f;
    float yPosition  = 0.0f;
    float peopleCount = 0.0f;
    PeopleCounting targetInfo;
    if (mmWaveSensor.getPeopleCountingTargetInfo(targetInfo) && !targetInfo.targets.empty()) {
        xPosition   = targetInfo.targets[0].x_point;
        yPosition   = targetInfo.targets[0].y_point;
        peopleCount = static_cast<float>(targetInfo.targets.size());
    }

    Serial.printf("MR60BHA2: breath=%.1f rpm  heart=%.1f bpm  dist=%.2f m  x=%.2f m  y=%.2f m  people=%d\n",
                  breathingRate, heartRate, distance, xPosition, yPosition, (int)peopleCount);

    const char* types[]  = {"breathing_rate", "heart_rate", "distance", "x_position", "y_position", "people_count"};
    const float values[] = {breathingRate, heartRate, distance, xPosition, yPosition, peopleCount};
    publishMeasures(client, topic, types, values, 6);
}
