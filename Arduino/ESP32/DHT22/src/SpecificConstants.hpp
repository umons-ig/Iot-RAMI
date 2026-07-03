#ifndef SPECIFIC_CONSTANTS
#define SPECIFIC_CONSTANTS

#if !defined(PROGMEM)
#define PROGMEM
#endif

/******
 * Usage of PROGMEM
 * -----------------
 * PROGMEM is used to store variables in flash memory (program memory) instead of SRAM.
 * This is particularly useful on microcontrollers with limited SRAM.
 * To decide whether a string should be stored in PROGMEM, we consider its length and its access frequency.
 * - If the string is long and accessed rarely, it should be stored in PROGMEM.
 * - Else, it should remain in SRAM for performance reasons.
 ******/

// ----------------------------------- PART SPECIFIC TO A MICROCONTROLLER ---------------------------------------------------
// For instance, the wifi password may be different according to where the microcontroller is going to be used.

/****** WiFi Connection Details and root certificate *******/
// PROGMEM beacause these settings are used only once at the beginning
//extern const char* SSID PROGMEM;
//extern const char* PASSWORD PROGMEM;
extern const char *ROOT_CA PROGMEM;// may be common

/****** MQTT Broker Settings; PROGREM because same as wifi, except for the topics constants which we access very often *******/
extern const int MQTT_PORT;                // may be common


/****** Settings; PROGREM would be useless here *******/
extern const unsigned int NUMBER_OF_VALUES_PER_SECOND;
extern const long INTERVAL;
extern unsigned long previousMillis;
extern bool allow_to_publish;

#endif // SPECIFIC_CONSTANTS
