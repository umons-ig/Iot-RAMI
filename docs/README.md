# Documentation technique — RAMI 1.0

> 👋 **Nouveau sur le projet ?** Commence par **[PASSATION.md](./PASSATION.md)** —
> accès à réclamer, runbook de déploiement, process de release firmware et gaps ouverts.

| Document       | Description                                                    |
|----------------|----------------------------------------------------------------|
| [PASSATION.md](./PASSATION.md) | **Reprise du projet** : accès, déploiement, release firmware, gaps |
| [AUDIT_SECURITE.md](./AUDIT_SECURITE.md) | **Audit de sécurité (07/08/2026)** : failles corrigées et vérifiées, arbitrages, pièges à ne pas réintroduire, ce qui reste ouvert |
| [FIRMWARE_DEPLOYMENT.md](./FIRMWARE_DEPLOYMENT.md) | Flash USB, portail de configuration, OTA, console de gestion du fog, MQTT en TLS |
| [FIRMWARE_ARCHITECTURE.md](./FIRMWARE_ARCHITECTURE.md) | Architecture du firmware unifié : `ISensor`, drivers, SensorRunner |
| [MQTT.md](./MQTT.md)   | Topics MQTT, protocole capteur/fog, format des messages |
| [KAFKA.md](./KAFKA.md) | Topic Kafka `sensor-data`, schemas des 3 types de messages (`start`, `data`, `stop`) |
| [API.md](./API.md)     | Reference complete de l'API REST + WebSocket Socket.io  |
| [MONITORING.md](./MONITORING.md) | Prometheus & Grafana — métriques exposées, datasource, import dashboard |
| [DEMO.md](./DEMO.md)   | Scenario de demonstration pas a pas                     |
| [RAPPORT.md](./RAPPORT.md) | Rapport de contribution du stage                    |
| [LOAD_TEST.md](./LOAD_TEST.md) | Résultats et analyse du test de charge (17/03/2026) |
| [IMPROVEMENTS.md](./IMPROVEMENTS.md) | Backlog priorisé des améliorations (effort, fichiers concernés) |
| [ETAT_DES_LIEUX.md](./ETAT_DES_LIEUX.md) | Audit complet du 09/06/2026 + axes stratégiques (sécurité fog→Kafka, rétention locale, MQTT/Home Assistant) |
| [FOG_PERSISTENCE.md](./FOG_PERSISTENCE.md) | Conception : rétention locale & store-and-forward sur le fog (données médicales durables) |
| [MQTT_HOMEASSISTANT.md](./MQTT_HOMEASSISTANT.md) | Conception : standardisation MQTT (type zigbee2mqtt) & intégration Home Assistant |

## Architecture en bref

```
Capteur/Simulateur
    |
    | MQTT ({topic}/sensor)
    v
Fog-service (Mosquitto local)
    |
    | Kafka (sensor-data)
    v
Backend Cloud (Express :3000)
    |----> PostgreSQL/TimescaleDB
    |----> WebSocket (Socket.io) --> Frontend Vue 3 (:8080)
    |----> GET /metrics
              |
              v
         Prometheus (:9090) --> Grafana (:3001)
```

Voir aussi : [ROADMAP.md](../ROADMAP.md) pour l'historique des phases du projet.
