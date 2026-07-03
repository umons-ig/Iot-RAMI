#include "CompositeSensor.hpp"

bool CompositeSensor::add(ISensor* sensor) {
  if (!sensor || count >= MAX_SENSORS) return false;
  sensors[count++] = sensor;
  return true;
}

void CompositeSensor::begin() {
  for (int i = 0; i < count; i++) sensors[i]->begin();
}

void CompositeSensor::poll() {
  for (int i = 0; i < count; i++) sensors[i]->poll();
}

int CompositeSensor::read(SensorMeasure* out, int maxOut) {
  int n = 0;
  for (int i = 0; i < count && n < maxOut; i++) {
    n += sensors[i]->read(out + n, maxOut - n);
  }
  return n;
}
