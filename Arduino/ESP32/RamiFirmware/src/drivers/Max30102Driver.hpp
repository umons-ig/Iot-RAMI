#ifndef MAX30102_DRIVER_HPP
#define MAX30102_DRIVER_HPP
#ifdef ENABLE_MAX30102
#include "ISensor.hpp"
#include <stdint.h>

// Oxymètre de pouls MAX30102 (I2C) -> spo2 + heart_rate.
// Capteur à fenêtre : poll() accumule des échantillons IR/Rouge, read() lance
// l'algorithme Maxim quand la fenêtre est pleine.
class Max30102Driver : public ISensor {
public:
  void begin() override;
  void poll() override;
  int read(SensorMeasure* out, int maxOut) override;
private:
  static const int WINDOW = 100;
  uint32_t irBuffer[WINDOW];
  uint32_t redBuffer[WINDOW];
  int filled = 0;
  bool ready = false;
};
#endif
#endif
