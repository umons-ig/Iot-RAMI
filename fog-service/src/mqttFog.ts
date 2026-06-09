import mqtt, { MqttClient } from "mqtt";
import { BROKER_INFO, TOPICS, MESSAGE_FIELDS, COMMANDS, BUFFER_CONFIG } from "./constants";
import KafkaService from "./kafkaProducer";

class MqttFog {
  private static instance: MqttFog | undefined;
  private mqttClient!: MqttClient;
  private kafkaService!: KafkaService;
  private buffer = new Map<string, any[]>();
  private flushIntervalMs = BUFFER_CONFIG.flushIntervalMs;
  private flushMaxSize = BUFFER_CONFIG.flushMaxSize;
  private maxBufferSize = BUFFER_CONFIG.maxBufferSize;
  private dropWarnedTopics = new Set<string>();
  private sensorTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();
  private sessionMaxDurationMs = BUFFER_CONFIG.sessionMaxDurationMs;
  private flushInterval: NodeJS.Timeout | undefined;

  private constructor() {
    // Constructeur privé pour empêcher l'instanciation directe
  }
  public static async getInstance(): Promise<MqttFog> {
    if (MqttFog.instance === undefined) {
      MqttFog.instance = new MqttFog();
      await MqttFog.instance.connectBroker();
      MqttFog.instance.kafkaService = await KafkaService.getInstance();
    }
    return MqttFog.instance;
  }

  /**
   * Arrêt propre : flushe tous les buffers en mémoire vers Kafka,
   * déconnecte le producteur Kafka, puis ferme le client MQTT.
   * Appelé sur SIGTERM/SIGINT pour éviter la perte des mesures bufferisées.
   */
  public async shutdown(): Promise<void> {
    console.log("[FogService] Arrêt en cours — flush des buffers...");

    // 1. Flush de tous les topics en parallèle, sans qu'une erreur par topic ne bloque les autres
    const topics = [...this.buffer.keys()];
    await Promise.all(
      topics.map((topic) =>
        this.flushBuffer(topic).catch((e) =>
          console.error(`❌ [shutdown] Erreur flush ${topic}:`, e),
        ),
      ),
    );

    // Stopper le flush périodique et les timers résiduels
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }
    this.sensorTimeouts.forEach((t) => clearTimeout(t));
    this.sensorTimeouts.clear();
    this.sessionTimers.forEach((t) => clearTimeout(t));
    this.sessionTimers.clear();

    // 2. Déconnexion du producteur Kafka
    try {
      const kafka = await KafkaService.getInstance();
      await kafka.disconnect();
    } catch (e) {
      console.error("❌ [shutdown] Erreur déconnexion Kafka:", e);
    }

    // 3. Fermeture propre du client MQTT
    await new Promise<void>((resolve) => {
      if (!this.mqttClient) {
        resolve();
        return;
      }
      this.mqttClient.end(false, {}, () => {
        console.log("[MQTT] Client fermé");
        resolve();
      });
    });

    console.log("[FogService] Arrêt terminé");
  }

  private async connectBroker(): Promise<void> {
    try {
      const connectOptions: mqtt.IClientOptions = {
        clientId: "FogServiceClient",
        username: BROKER_INFO.username,
        password: BROKER_INFO.password,
        port: BROKER_INFO.port,
      };

      // Créer le client MQTT
      this.mqttClient = mqtt.connect(`${BROKER_INFO.url}`, connectOptions);

      // Attacher les handlers AVANT la connexion
      this.mqttClient.on("connect", () => {
        console.log("🟢 [MQTT] Connecté au broker");
        this.handleConnect();
      });

      // Handler de messages
      this.mqttClient.on("message", (topic: string, message: Buffer) => {
        this.handleMessageReceivedFromSensor(topic, message);
      });

      // Handler d'erreur
      this.mqttClient.on("error", (error) => {
        console.error("❌ [MQTT] Erreur:", error);
      });

      // Handlers de cycle de vie de la connexion (visibilité des coupures)
      this.mqttClient.on("reconnect", () => {
        console.log("[MQTT] Tentative de reconnexion au broker...");
      });

      this.mqttClient.on("offline", () => {
        console.warn("[MQTT] Client hors ligne (broker injoignable)");
      });

      this.mqttClient.on("close", () => {
        console.warn("[MQTT] Connexion au broker fermée");
      });

    } catch (error) {
      console.error("❌ [connectBroker] Erreur:", error);
      throw error;
    }
  }

  private handleConnect(): void {
    this.mqttClient.subscribe("#");
    this.startFlushInterval();
  }
  private handlePing(topic: string): void {
    clearTimeout(this.sensorTimeouts.get(topic));
    const timeout = setTimeout(() => {
      this.sensorTimeouts.delete(topic);
      console.log(`⚠️ [Sensor Timeout] Sensor ${topic} is offline`);
      if (this.buffer.has(topic)) {
        this.handleStop(topic).catch((e) =>
          console.error("❌ [Sensor Timeout] Erreur handleStop:", e),
        );
      }
    }, 30000);
    this.sensorTimeouts.set(topic, timeout);
  }
  private async startSession(topic: string): Promise<void> {
    if (!this.buffer.has(topic)) {
      this.buffer.set(topic, []);
    }
    try {
      await this.kafkaService.publishBatchSensorData("sensor-data", [
        { type: "start", sensorTopic: topic, timestamp: Date.now() },
      ]);
      console.log(`▶️ [Kafka] START envoyé pour ${topic}`);
    } catch (error) {
      console.error(`❌ [startSession] Erreur Kafka:`, error);
    }
    clearTimeout(this.sessionTimers.get(topic));
    const timer = setTimeout(() => {
      console.log(`🔄 [Session] Durée max atteinte pour ${topic} — rotation de session`);
      this.handleStop(topic)
        .then(() => this.startSession(topic))
        .catch((e) => console.error(`❌ [Session] Erreur lors de la rotation pour ${topic}:`, e));
    }, this.sessionMaxDurationMs);
    this.sessionTimers.set(topic, timer);
  }
  private async handleStart(topic: string): Promise<void> {
    await this.startSession(topic);
    this.sendAck(topic);
  }
  private async handleStop(topic: string): Promise<void> {
    clearTimeout(this.sessionTimers.get(topic));
    this.sessionTimers.delete(topic);
    await this.flushBuffer(topic);
    try {
      await this.kafkaService.publishBatchSensorData("sensor-data", [
        { type: "stop", sensorTopic: topic, timestamp: Date.now() },
      ]);
      console.log(`⏹️ [Kafka] STOP envoyé pour ${topic}`);
    } catch (error) {
      console.error(`❌ [handleStop] Erreur Kafka:`, error);
    }
    this.buffer.delete(topic);
  }
  private sendAck(topic: string): void {
    const serveurTopic = topic.replace(TOPICS.SENSOR, TOPICS.SERVER);
    this.mqttClient.publish(
      serveurTopic,
      JSON.stringify({ [MESSAGE_FIELDS.ANS]: COMMANDS.ACK }),
    );
  }
  private handleMeasurement(topic: string, data: any): void {
    if (!this.buffer.has(topic)) {
      console.warn(`⚠️ [handleMeasurement] Mesures reçues sans session active pour: ${topic} — ignorées`);
      return;
    }
    const dataArray = this.buffer.get(topic)!;
    if (dataArray.length >= this.maxBufferSize) {
      if (!this.dropWarnedTopics.has(topic)) {
        console.warn(`⚠️ [handleMeasurement] Buffer plein (${this.maxBufferSize}) pour ${topic} — messages droppés jusqu'au prochain flush`);
        this.dropWarnedTopics.add(topic);
      }
      return;
    }
    if (dataArray.length >= this.flushMaxSize) {
      this.flushBuffer(topic).catch((e) => console.error("❌ [flushBuffer]", e));
    }
    dataArray.push(data);
  }
  private async flushBuffer(topic: string): Promise<void> {
    const dataArray = this.buffer.get(topic);
    if (dataArray && dataArray.length > 0) {
      try {
        const batch = {
          type: "data",
          sensorTopic: topic,
          measures: dataArray,
        };
        await this.kafkaService.publishBatchSensorData("sensor-data", [batch]);
        this.buffer.set(topic, []);
        this.dropWarnedTopics.delete(topic);
      } catch (error) {
        console.error(`❌ [flushBuffer] Erreur Kafka pour ${topic}:`, error);
      }
    }
  }
  private startFlushInterval(): void {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => {
      const flushPromises = [];
      for (const [topic, dataArray] of this.buffer.entries()) {
        if (dataArray.length > 0) {
          flushPromises.push(
            this.flushBuffer(topic).catch((e) =>
              console.error(`❌ [startFlushInterval] Erreur flush ${topic}:`, e),
            ),
          );
        }
      }
      if (flushPromises.length > 0) {
        Promise.all(flushPromises).catch((e) =>
          console.error("❌ [startFlushInterval] Erreur Promise.all:", e),
        );
      }
    }, this.flushIntervalMs);
  }

  private handleMessageReceivedFromSensor(
    topic: string,
    message: Buffer,
  ): void {
    try {
      if (!topic.endsWith(TOPICS.SENSOR)) {
        return;
      }

      const parsed = JSON.parse(message.toString());
      if (parsed[MESSAGE_FIELDS.CMD] === COMMANDS.PING) {
        this.handlePing(topic);
      } else if (parsed[MESSAGE_FIELDS.CMD] === COMMANDS.START) {
        this.handleStart(topic).catch((e) => console.error("❌ [handleStart]", e));
      } else if (parsed[MESSAGE_FIELDS.CMD] === COMMANDS.STOP) {
        this.handleStop(topic).catch((e) => console.error("❌ [handleStop]", e));
      } else if (parsed[MESSAGE_FIELDS.MEASURES]) {
        this.handleMeasurement(topic, {
          measures: parsed[MESSAGE_FIELDS.MEASURES],
          timestamp: parsed[MESSAGE_FIELDS.TIMESTAMP],
        });
      } else {
        console.warn(
          "⚠️ [handleMessageReceivedFromSensor] Commande inconnue ou données manquantes:",
          parsed,
        );
      }
    } catch (error) {
      console.error(
        "❌ [handleMessageReceivedFromSensor] Erreur de traitement du message:",
        error,
      );
    }
  }
}
export default MqttFog;
