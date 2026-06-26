export const TOPICS = {
  SENSOR: "/sensor",
  SERVER: "/server",
};

export const COMMANDS = {
  PING: "ping",
  START: "start",
  STOP: "stop",
  ACK: "ack",
};

export const MESSAGE_FIELDS = {
  TIMESTAMP: "timestamp",
  CMD: "cmd",
  ANS: "ans",
  MEASURES: "measures",
};

export const BROKER_INFO = {
  url: process.env.MQTT_URL ?? "mqtt://localhost",
  port: parseInt(process.env.MQTT_PORT ?? "1883"),
  username: process.env.MQTT_USERNAME ?? "",
  password: process.env.MQTT_PASSWORD ?? "",
};

export const KAFKA_CONFIG = {
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
};

// ─── Observabilité (serveur de métriques Prometheus) ──────────────────────────
export const METRICS_CONFIG = {
  port: parseInt(process.env.METRICS_PORT ?? "9100"),
};

// ─── Web server de gestion des ESP (commandes à distance) ─────────────────────
export const MANAGEMENT_CONFIG = {
  port: parseInt(process.env.MGMT_PORT ?? "9200"),
};

// ─── Mises à jour firmware (OTA via GitHub Releases — « Watchtower firmware ») ─
export const FIRMWARE_CONFIG = {
  // Désactivé par défaut : l'auto-OTA en contexte médical doit être explicite.
  enabled: (process.env.FIRMWARE_OTA_ENABLED ?? "false") === "true",
  repo: process.env.FIRMWARE_REPO ?? "GaspardMenou/Iot-RAMI",
  env: process.env.FIRMWARE_ENV ?? "universal",
  currentVersion: process.env.FIRMWARE_VERSION ?? "v0.0.0",
  pollIntervalMs: parseInt(process.env.FIRMWARE_POLL_INTERVAL_MS ?? "3600000"), // 1 h
};

// ─── Intégration Zigbee2MQTT ──────────────────────────────────────────────────
// Préfixe des topics publiés par Z2M sur le même broker (cf. docs/MULTI_PROTOCOL_ZIGBEE.md).
export const ZIGBEE_CONFIG = {
  topicPrefix: process.env.ZIGBEE_TOPIC_PREFIX ?? "zigbee2mqtt/",
};

export const BUFFER_CONFIG = {
  flushIntervalMs: parseInt(process.env.FLUSH_INTERVAL_MS ?? "200"),
  flushMaxSize: parseInt(process.env.FLUSH_MAX_SIZE ?? "50"),
  maxBufferSize: parseInt(process.env.MAX_BUFFER_SIZE ?? "500"),
  sessionMaxDurationMs: parseInt(process.env.SESSION_MAX_DURATION_MS ?? "3600000"),
  // Timeout capteur muet. Le capteur pingue toutes les 20 s ; on vise ≥ 2,5×
  // l'intervalle pour tolérer la perte d'un ping (jitter WiFi). Avant : 30 s codé
  // en dur (marge d'une seule perte). Cf. revue MQTT §6.
  sensorTimeoutMs: parseInt(process.env.SENSOR_TIMEOUT_MS ?? "50000"),
};

// ─── Postgres local (outbox store-and-forward) ────────────────────────────────
export const PG_CONFIG = {
  host: process.env.PG_HOST ?? "localhost",
  port: parseInt(process.env.PG_PORT ?? "5432"),
  user: process.env.PG_USER ?? "fog",
  password: process.env.PG_PASSWORD ?? "fog",
  database: process.env.PG_DATABASE ?? "fog_outbox",
};

// ─── Outbox / réplicateur store-and-forward ───────────────────────────────────
export const OUTBOX_CONFIG = {
  // Intervalle entre deux tentatives de réplication vers Kafka (ms)
  replicatorIntervalMs: parseInt(process.env.OUTBOX_REPLICATOR_INTERVAL_MS ?? "500"),
  // Nombre max de lignes pending lues/publiées par tick
  replicatorBatchSize: parseInt(process.env.OUTBOX_BATCH_SIZE ?? "200"),
  // Durée de conservation des lignes synced avant purge (jours)
  retentionDays: parseInt(process.env.OUTBOX_RETENTION_DAYS ?? "7"),
  // Intervalle entre deux purges (ms, défaut 1h)
  purgeIntervalMs: parseInt(process.env.OUTBOX_PURGE_INTERVAL_MS ?? "3600000"),
};
