import { Kafka, Consumer, SASLOptions } from "kafkajs";
import { envs } from "@/utils/env";
class KafkaService {
  private static instance: KafkaService | undefined;
  private kafka!: Kafka;
  private consumer!: Consumer;
  private isKafkaConnected = false;
  private mapTopicCallbacks: Map<string, (data: any) => void> = new Map();

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
        clientId: "sensor-app",
        brokers: envs.KAFKA_BROKERS.split(","),
        // Sécurité optionnelle : défaut = PLAINTEXT (subnet local de confiance).
        // Activer via variables d'env pour un réseau non fiable (voir docs/ETAT_DES_LIEUX.md).
        ssl: process.env.KAFKA_SSL === "true",
        sasl: process.env.KAFKA_SASL_USERNAME
          ? ({
              mechanism: process.env.KAFKA_SASL_MECHANISM ?? "scram-sha-512",
              username: process.env.KAFKA_SASL_USERNAME,
              password: process.env.KAFKA_SASL_PASSWORD ?? "",
            } as SASLOptions)
          : undefined,
        retry: {
          initialRetryTime: 100,
          retries: 5,
        },
      });

      this.consumer = this.kafka.consumer({ groupId: "sensor-group" });
    } catch (error) {
      console.error("❌ [Kafka] Erreur de connexion:", error);
      throw error;
    }
  }

  private async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      console.log("✅ Kafka Consumer connected successfully");

      this.isKafkaConnected = true;
    } catch (error) {
      console.error("❌ Error connecting to Kafka:", error);
      this.isKafkaConnected = false;
      throw error;
    }
  }

  public registerTopic(topic: string, callback: (data: any) => void): void {
    this.mapTopicCallbacks.set(topic, callback);
  }

  public async startConsuming(): Promise<void> {
    try {
      for (const topic of this.mapTopicCallbacks.keys()) {
        await this.consumer.subscribe({ topic });
      }
      await this.consumer.run({
        eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
          for (const message of batch.messages) {
            if (!message.value) {
              console.warn("⚠️ [Kafka] Message vide reçu, ignoré");
              continue;
            }
            const data = JSON.parse(message.value.toString());
            const callback = this.mapTopicCallbacks.get(batch.topic);
            if (callback) {
              await callback(data);
            } else {
              console.warn("⚠️ No callback registered for topic:", batch.topic);
            }
            resolveOffset(message.offset);
            await heartbeat();
          }
        },
      });
      console.log("✅ Kafka Consumer started consuming");
    } catch (error) {
      console.error("❌ Error starting Kafka consumer:", error);
      throw error;
    }
  }

  public isConnected(): boolean {
    return this.isKafkaConnected;
  }
  public async disconnect(): Promise<void> {
    try {
      await this.consumer.disconnect();
      console.log("👋 Kafka Consumer disconnected");
      this.isKafkaConnected = false;
    } catch (error) {
      console.error("❌ Error disconnecting from Kafka:", error);
      throw error;
    }
  }
}

export default KafkaService;
