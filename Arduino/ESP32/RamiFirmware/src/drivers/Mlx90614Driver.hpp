#ifndef MLX90614_DRIVER_HPP
#define MLX90614_DRIVER_HPP
#ifdef ENABLE_MLX90614
#include "ISensor.hpp"
// Thermomètre infrarouge sans contact MLX90614 (I2C) -> body_temperature.
class Mlx90614Driver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
private:
  bool ok = false;
};
#endif
#endif
