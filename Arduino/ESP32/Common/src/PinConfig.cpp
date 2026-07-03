#include "PinConfig.hpp"
#include <Preferences.h>
#include <ArduinoJson.h>

static StaticJsonDocument<512> g_pins;
static String g_raw = "{}";

void loadPinConfig() {
  Preferences p;
  p.begin("fog", true);
  g_raw = p.getString("pins", "{}");
  p.end();
  g_pins.clear();
  if (deserializeJson(g_pins, g_raw)) {
    g_pins.clear();  // JSON invalide -> config vide (tout par défaut)
    g_raw = "{}";
  }
}

void savePinConfig(const String& json) {
  Preferences p;
  p.begin("fog", false);
  p.putString("pins", json);
  p.end();
  g_raw = json;
  g_pins.clear();
  if (deserializeJson(g_pins, json)) {
    g_pins.clear();
  }
}

String getPinConfigJson() { return g_raw; }

int getConfiguredPin(const char* sensor, const char* role, int defaultPin) {
  if (g_pins.containsKey(sensor) && g_pins[sensor].containsKey(role)) {
    return g_pins[sensor][role] | defaultPin;
  }
  return defaultPin;
}
