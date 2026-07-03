#ifndef SPECIFIC_CONSTANTS
#define SPECIFIC_CONSTANTS

#if !defined(PROGMEM)
#define PROGMEM
#endif

// ----------------------------------- PART SPECIFIC TO MR60BHA2 ---------------------------------------------------

/****** Root CA (TLS) *******/
extern const char *ROOT_CA PROGMEM;

/****** MQTT *******/
extern const int MQTT_PORT;

/****** Timing *******/
// Le capteur mmWave produit des données à ~1 Hz — inutile de publier plus vite.
// Ajuste NUMBER_OF_VALUES_PER_SECOND si tu veux un taux différent.
extern const unsigned int NUMBER_OF_VALUES_PER_SECOND;
extern const long INTERVAL;
extern unsigned long previousMillis;
extern bool allow_to_publish;

#endif // SPECIFIC_CONSTANTS
