#ifndef COMPOSITE_SENSOR_HPP
#define COMPOSITE_SENSOR_HPP

#include "ISensor.hpp"

// Agrège plusieurs capteurs en un seul ISensor : begin()/poll() sur tous,
// read() concatène leurs mesures. Permet de choisir « un OU plusieurs capteurs »
// pour un même device (cf. docs/FIRMWARE_ARCHITECTURE.md, firmware config-driven).
class CompositeSensor : public ISensor {
public:
  // Enregistre un capteur. Renvoie false si plein ou pointeur nul.
  bool add(ISensor* sensor);

  void begin() override;
  void poll() override;
  int read(SensorMeasure* out, int maxOut) override;

private:
  static const int MAX_SENSORS = 8;
  ISensor* sensors[MAX_SENSORS];
  int count = 0;
};

#endif // COMPOSITE_SENSOR_HPP
