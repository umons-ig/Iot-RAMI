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

export const BUFFER_CONFIG = {
  flushIntervalMs: parseInt(process.env.FLUSH_INTERVAL_MS ?? "200"),
  flushMaxSize: parseInt(process.env.FLUSH_MAX_SIZE ?? "50"),
  maxBufferSize: parseInt(process.env.MAX_BUFFER_SIZE ?? "500"),
  sessionMaxDurationMs: parseInt(process.env.SESSION_MAX_DURATION_MS ?? "3600000"),
};
