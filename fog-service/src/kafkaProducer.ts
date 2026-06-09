import { Kafka, Producer, CompressionTypes } from "kafkajs";
import { KAFKA_CONFIG } from "./constants";
class KafkaService {
  private static instance: KafkaService | undefined;
  private kafka!: Kafka;
  private producer!: Producer;
  private isKafkaConnected = false;
  private constructor() {
    // Constructeur privé pour empêcher l'instanciation directe}
  }
  public static async getInstance(): Promise<KafkaService> {
    if (!KafkaService.instance) {
      try {
        KafkaService.instance = new KafkaService();
        await KafkaService.instance.connectToKafka();
        await KafkaService.instance.connect();
      } catch (error) {
        KafkaService.instance = undefined; // Reset instance on failure
        throw error; // Rethrow to handle it in the caller
      }
    }
    return KafkaService.instance;
  }

  private async connectToKafka(): Promise<void> {
    try {
      this.kafka = new Kafka({
        clientId: "fog-service",
        brokers: KAFKA_CONFIG.brokers,
        // Sécurité optionnelle — défaut PLAINTEXT (subnet local de confiance).
        // ssl: false et sasl: undefined => comportement identique à aujourd'hui.
        ssl: process.env.KAFKA_SSL === "true",
        sasl: process.env.KAFKA_SASL_USERNAME
          ? {
              mechanism: (process.env.KAFKA_SASL_MECHANISM ?? "scram-sha-512") as any,
              username: process.env.KAFKA_SASL_USERNAME,
              password: process.env.KAFKA_SASL_PASSWORD ?? "",
            }
          : undefined,
        retry: {
          initialRetryTime: 100,
          retries: 5,
        },
      });

      this.producer = this.kafka.producer();

      // Refléter l'état réel de la connexion : kafkajs gère sa propre
      // reconnexion interne, on se contente de suivre le flag.
      this.producer.on(this.producer.events.DISCONNECT, () => {
        this.isKafkaConnected = false;
        console.warn("[Kafka] Producer déconnecté");
      });
      this.producer.on(this.producer.events.CONNECT, () => {
        this.isKafkaConnected = true;
      });
    } catch (error) {
      console.error("❌ [Kafka] Erreur de connexion:", error);
      throw error;
    }
  }

  private async connect(): Promise<void> {
    try {
      await this.producer.connect();
      console.log("✅ Kafka Producer connected successfully");
      this.isKafkaConnected = true;
    } catch (error) {
      console.error("❌ Error connecting to Kafka:", error);
      this.isKafkaConnected = false;
      throw error;
    }
  }

  public async publishSensorData(topic: string, data: any): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [{ key: data.sensorTopic, value: JSON.stringify(data) }],
        compression: CompressionTypes.GZIP,
      });
    } catch (error) {
      console.error("❌ Error publishing to Kafka:", error);
      throw error;
    }
  }
  public async publishBatchSensorData(
    topic: string,
    dataArray: any[],
  ): Promise<void> {
    try {
      const messages = dataArray.map((data) => ({
        key: data.sensorTopic,
        value: JSON.stringify(data),
      }));
      await this.producer.send({
        topic,
        messages,
        compression: CompressionTypes.GZIP,
      });
    } catch (error) {
      console.error("❌ Error publishing batch to Kafka:", error);
      throw error;
    }
  }
  public isConnected(): boolean {
    return this.isKafkaConnected;
  }
  public async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      console.log("👋 Kafka Producer disconnected");

      this.isKafkaConnected = false;
    } catch (error) {
      console.error("❌ Error disconnecting from Kafka:", error);
      throw error;
    }
  }
}

export default KafkaService;
