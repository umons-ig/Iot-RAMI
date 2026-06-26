#ifndef MR60BHA2_DRIVER_HPP
#define MR60BHA2_DRIVER_HPP

#ifdef ENABLE_MR60BHA2

#include "ISensor.hpp"

// Radar mmWave Seeed MR60BHA2 (présence, respiration, rythme cardiaque, position).
// Capteur UART : nécessite poll() à chaque itération pour dépiler les trames.
class Mr60bha2Driver : public ISensor {
public:
  void begin() override;
  void poll() override;
  int read(SensorMeasure* out, int maxOut) override;
};

#endif // ENABLE_MR60BHA2
#endif // MR60BHA2_DRIVER_HPP
