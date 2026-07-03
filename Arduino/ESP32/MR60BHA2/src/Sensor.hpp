#ifndef SENSOR
#define SENSOR

#include <HardwareSerial.h>
#include <PubSubClient.h>
#include <Seeed_Arduino_mmWave.h>

// UART0 (Serial0) — pins par défaut ESP32-C6 : TX=GPIO16(D6), RX=GPIO17(D7)
// On laisse HardwareSerial(0) gérer les pins, comme dans l'exemple Seeed.
extern HardwareSerial mmWaveSerial;
extern SEEED_MR60BHA2 mmWaveSensor;

void setupSensor();
void updateSensor();
void readAndPublishMeasures(PubSubClient& client, const char* topic);

#endif // SENSOR
