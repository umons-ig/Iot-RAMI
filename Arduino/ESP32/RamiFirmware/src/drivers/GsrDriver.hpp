#ifndef GSR_DRIVER_HPP
#define GSR_DRIVER_HPP
#ifdef ENABLE_GSR
#include "ISensor.hpp"
#ifndef GSR_PIN
#define GSR_PIN 34
#endif
// Réponse électrodermale (GSR) analogique -> gsr (valeur brute ADC).
class GsrDriver : public ISensor {
public:
  void begin() override;
  int read(SensorMeasure* out, int maxOut) override;
};
#endif
#endif
