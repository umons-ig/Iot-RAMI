#ifdef ENABLE_MR60BHA2

#include "Mr60bha2Driver.hpp"
#include <Arduino.h>
#include <HardwareSerial.h>
#include <Seeed_Arduino_mmWave.h>

// UART0 (pins par défaut), comme l'exemple Seeed.
static HardwareSerial mmWaveSerial(0);
static SEEED_MR60BHA2 mmWaveSensor;

void Mr60bha2Driver::begin() {
  mmWaveSensor.begin(&mmWaveSerial);
  Serial.println("[MR60BHA2] initialise");
}

void Mr60bha2Driver::poll() {
  // Attend jusqu'à 100 ms une trame complète (sinon le buffer n'a pas le temps
  // de se remplir) — appelé à chaque loop par le SensorRunner.
  mmWaveSensor.update(100);
}

int Mr60bha2Driver::read(SensorMeasure* out, int maxOut) {
  if (!mmWaveSensor.isHumanDetected()) return 0;

  float breathingRate = 0.0f, heartRate = 0.0f, distance = 0.0f;
  mmWaveSensor.getBreathRate(breathingRate);
  mmWaveSensor.getHeartRate(heartRate);
  mmWaveSensor.getDistance(distance);

  float xPosition = 0.0f, yPosition = 0.0f, peopleCount = 0.0f;
  PeopleCounting targetInfo;
  if (mmWaveSensor.getPeopleCountingTargetInfo(targetInfo) && !targetInfo.targets.empty()) {
    xPosition = targetInfo.targets[0].x_point;
    yPosition = targetInfo.targets[0].y_point;
    peopleCount = static_cast<float>(targetInfo.targets.size());
  }

  const char* types[] = {"breathing_rate", "heart_rate", "distance",
                         "x_position", "y_position", "people_count"};
  const float values[] = {breathingRate, heartRate, distance,
                          xPosition, yPosition, peopleCount};
  int n = 0;
  for (int i = 0; i < 6 && n < maxOut; i++) out[n++] = {types[i], values[i]};
  return n;
}

#endif // ENABLE_MR60BHA2
