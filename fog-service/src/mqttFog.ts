import mqtt, { MqttClient } from "mqtt";
import os from "os";
import {
  BROKER_INFO,
  TOPICS,
  MESSAGE_FIELDS,
  COMMANDS,
  BUFFER_CONFIG,
  OUTBOX_CONFIG,
  ZIGBEE_CONFIG,
} from "./constants";
import KafkaService from "./kafkaProducer";
import { Outbox } from "./outbox";

/**
 * Convertit un payload plat Zigbee2MQTT (`{ temperature: 21, humidity: 50,
 * occupancy: true, … }`) en mesures RAMI. Auto-descriptif façon Z2M : toute clé
 * numérique devient une mesure ; les booléens → 0/1 ; le reste (chaînes, objets,
 * null, métadonnées) est ignoré. Cf. docs/MULTI_PROTOCOL_ZIGBEE.md §4.
 */
export const mapZigbeeToMeasures = (
  payload: Record<string, unknown>
): Array<{ measureType: string; value: number }> => {
  if (!payload || typeof payload !== "object") return [];
  const measures: Array<{ measureType: string; value: number }> = [];
  for (const [key, raw] of Object.entries(payload)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      measures.push({ measureType: key, value: raw });
    } else if (typeof raw === "boolean") {
      measures.push({ measureType: key, value: raw ? 1 : 0 });
    }
  }
  return measures;
};

// Élément bufferisé : un lot de mesures horodaté (timestamp en µs, optionnel
// pour les sources qui n'en fournissent pas).
interface BufferedMeasure {
  measures: unknown;
  timestamp?: number;
}

class MqttFog {
  private static instance: MqttFog | undefined;
  private mqttClient!: MqttClient;
  private kafkaService!: KafkaService;
  private outbox!: Outbox;
  private buffer = new Map<string, BufferedMeasure[]>();
  // Topics /sensor des ESP vus au moins une fois (≠ Zigbee). Sert au web server
  // de gestion à pousser des commandes (ota/set_wifi/set_mqtt/restart). §gestion
  private knownDevices = new Set<string>();
  // Version firmware rapportée par chaque ESP (via le PING). Sert à l'auto-OTA
  // ciblé : ne mettre à jour que les appareils en retard, sans variable d'env.
  private deviceVersions = new Map<string, string>();
  private flushIntervalMs = BUFFER_CONFIG.flushIntervalMs;
  private flushMaxSize = BUFFER_CONFIG.flushMaxSize;
  private maxBufferSize = BUFFER_CONFIG.maxBufferSize;
  private dropWarnedTopics = new Set<string>();
  private dropCount = 0; // nombre cumulé de messages droppés (buffer plein) — métrique §3.1
  private sensorTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();
  private sessionMaxDurationMs = BUFFER_CONFIG.sessionMaxDurationMs;
  private sensorTimeoutMs = BUFFER_CONFIG.sensorTimeoutMs;
  private zigbeeTopicPrefix = ZIGBEE_CONFIG.topicPrefix;
  private flushInterval: NodeJS.Timeout | undefined;
  // ─── Store-and-forward (réplicateur outbox → Kafka) ───────────────────────
  private replicatorIntervalMs = OUTBOX_CONFIG.replicatorIntervalMs;
  private replicatorBatchSize = OUTBOX_CONFIG.replicatorBatchSize;
  private retentionDays = OUTBOX_CONFIG.retentionDays;
  private purgeIntervalMs = OUTBOX_CONFIG.purgeIntervalMs;
  private replicatorInterval: NodeJS.Timeout | undefined;
  private purgeInterval: NodeJS.Timeout | undefined;
  private isReplicating = false;

  private constructor() {
    // Constructeur privé pour empêcher l'instanciation directe
  }
  public static async getInstance(): Promise<MqttFog> {
    if (MqttFog.instance === undefined) {
      MqttFog.instance = new MqttFog();
      await MqttFog.instance.connectBroker();
      MqttFog.instance.kafkaService = await KafkaService.getInstance();
      // Outbox durable : créée APRÈS Kafka, démarre le réplicateur + la purge.
      MqttFog.instance.outbox = new Outbox();
      await MqttFog.instance.outbox.init();
      MqttFog.instance.startReplicator();
      MqttFog.instance.startPurge();
    }
    return MqttFog.instance;
  }

  /**
   * Instantané de métriques pour l'observabilité (§3.1) : lag store-and-forward,
   * état Kafka, drops buffer, taille du buffer mémoire. Exposé via /metrics.
   */
  public async getMetricsSnapshot(): Promise<{
    outboxPending: number;
    kafkaConnected: boolean;
    drops: number;
    bufferSize: number;
  }> {
    let outboxPending = 0;
    try {
      outboxPending = await this.outbox.pendingCount();
    } catch {
      // outbox indisponible : on remonte -1 pour le signaler côté métrique
      outboxPending = -1;
    }
    let bufferSize = 0;
    for (const arr of this.buffer.values()) bufferSize += arr.length;
    return {
      outboxPending,
      kafkaConnected: this.kafkaService?.isConnected() ?? false,
      drops: this.dropCount,
      bufferSize,
    };
  }

  /**
   * Arrêt propre : persiste les buffers mémoire restants dans l'outbox (durable),
   * stoppe les timers, déconnecte Kafka, ferme MQTT, puis ferme la base.
   * Appelé sur SIGTERM/SIGINT. Les mesures persistées seront répliquées au
   * prochain démarrage (reprise store-and-forward), donc aucune perte.
   */
  public async shutdown(): Promise<void> {
    console.log("[FogService] Arrêt en cours — persistance des buffers vers l'outbox...");

    // Stopper le réplicateur, la purge et le flush périodique d'abord
    if (this.replicatorInterval) {
      clearInterval(this.replicatorInterval);
      this.replicatorInterval = undefined;
    }
    if (this.purgeInterval) {
      clearInterval(this.purgeInterval);
      this.purgeInterval = undefined;
    }
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }

    // 1. Flush mémoire → outbox (persistance durable) en parallèle, sans qu'une
    //    erreur par topic ne bloque les autres
    const topics = [...this.buffer.keys()];
    await Promise.all(
      topics.map((topic) =>
        this.flushBuffer(topic).catch((e) =>
          console.error(`❌ [shutdown] Erreur flush ${topic}:`, e),
        ),
      ),
    );

    // Timers résiduels
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

    // 4. Fermeture de la base (les pending survivront et seront répliqués au reboot)
    if (this.outbox) {
      await this.outbox.close();
    }

    console.log("[FogService] Arrêt terminé");
  }

  private async connectBroker(): Promise<void> {
    try {
      const connectOptions: mqtt.IClientOptions = {
        // clientId unique par instance : Mosquitto impose l'unicité et déconnecte
        // le doublon. Un id fixe provoquait une « bataille de reconnexions » si
        // deux instances fog tournaient (rolling deploy). Cf. revue MQTT §5.
        clientId: `FogServiceClient-${os.hostname()}-${process.pid}`,
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
  private handlePing(topic: string, version?: string): void {
    if (version) this.deviceVersions.set(topic, version);
    clearTimeout(this.sensorTimeouts.get(topic));
    const timeout = setTimeout(() => {
      this.sensorTimeouts.delete(topic);
      console.log(`⚠️ [Sensor Timeout] Sensor ${topic} is offline`);
      if (this.buffer.has(topic)) {
        this.handleStop(topic).catch((e) =>
          console.error("❌ [Sensor Timeout] Erreur handleStop:", e),
        );
      }
    }, this.sensorTimeoutMs);
    this.sensorTimeouts.set(topic, timeout);
  }
  private async startSession(topic: string): Promise<void> {
    const isNewSession = !this.buffer.has(topic);
    if (isNewSession) {
      this.buffer.set(topic, []);
      // Write-ahead : START persisté AVANT l'ACK, UNIQUEMENT pour une nouvelle
      // session. Le capteur ré-émet START toutes les 30 s tant qu'il n'a pas reçu
      // l'ACK (ACK perdu, reconnexion) → sans cette garde, on empilait plusieurs
      // événements START pour une seule session réelle. Cf. revue MQTT §5.
      await this.outbox.enqueue({ type: "start", sensorTopic: topic, timestamp: Date.now() });
    }
    // Une session déjà active se contente de réarmer le timer de rotation (et le
    // ré-ACK est envoyé par handleStart pour stopper la ré-émission du capteur).
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
    // Persiste d'abord le reste des mesures bufferisées, puis l'événement STOP.
    await this.flushBuffer(topic);
    await this.outbox.enqueue({ type: "stop", sensorTopic: topic, timestamp: Date.now() });
    this.buffer.delete(topic);
  }
  private sendAck(topic: string): void {
    const serveurTopic = topic.replace(TOPICS.SENSOR, TOPICS.SERVER);
    this.mqttClient.publish(
      serveurTopic,
      JSON.stringify({ [MESSAGE_FIELDS.ANS]: COMMANDS.ACK }),
    );
  }

  // ─── Gestion à distance des ESP (utilisée par le web server) ───────────────
  /** Liste des topics /sensor des ESP vus (pour piloter/cibler les commandes). */
  public getKnownDevices(): string[] {
    return [...this.knownDevices];
  }

  /** Version firmware rapportée par chaque ESP (topic -> version), via le PING. */
  public getDeviceVersions(): Map<string, string> {
    return new Map(this.deviceVersions);
  }

  /** Publie une commande de gestion vers le topic /server d'un ESP. */
  public publishDeviceCommand(
    sensorTopic: string,
    payload: Record<string, unknown>,
  ): void {
    const serverTopic = sensorTopic.replace(TOPICS.SENSOR, TOPICS.SERVER);
    this.mqttClient.publish(serverTopic, JSON.stringify(payload));
  }

  /** Diffuse une commande à TOUS les ESP connus. Renvoie le nombre de cibles. */
  public broadcastDeviceCommand(payload: Record<string, unknown>): number {
    let count = 0;
    for (const topic of this.knownDevices) {
      this.publishDeviceCommand(topic, payload);
      count++;
    }
    return count;
  }
  private handleMeasurement(topic: string, data: BufferedMeasure): void {
    if (!this.buffer.has(topic)) {
      console.warn(`⚠️ [handleMeasurement] Mesures reçues sans session active pour: ${topic} — ignorées`);
      return;
    }
    const dataArray = this.buffer.get(topic)!;
    if (dataArray.length >= this.maxBufferSize) {
      this.dropCount++;
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
  /**
   * Traite un message Zigbee2MQTT (`zigbee2mqtt/<device>`). Les appareils Zigbee
   * publient en continu, sans START/STOP et sans timestamp : on ouvre une
   * **session glissante** automatique (rotation horaire via sessionMaxDurationMs)
   * et on **horodate à la réception** (les capteurs Zigbee sont bas débit, cf.
   * docs/MULTI_PROTOCOL_ZIGBEE.md §5). Le watchdog backend (§4.2) gère le silence.
   */
  private async handleZigbeeMessage(
    z2mTopic: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const device = z2mTopic.slice(this.zigbeeTopicPrefix.length);
    if (!device) return;
    const measures = mapZigbeeToMeasures(payload);
    if (measures.length === 0) return;

    // Topic RAMI normalisé : l'appareil Zigbee devient un capteur comme un autre
    // (auto-discover, sessions, etc.).
    const sensorTopic = `${device}${TOPICS.SENSOR}`;
    if (!this.buffer.has(sensorTopic)) {
      await this.startSession(sensorTopic);
    }
    // Horodatage à la réception, en microsecondes (cohérent avec le reste du pipeline).
    this.handleMeasurement(sensorTopic, {
      measures,
      timestamp: Date.now() * 1000,
    });
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
        // Écriture LOCALE durable (rapide) — la réplication vers Kafka est
        // découplée (cf. startReplicator). On ne perd jamais une mesure ACK'ée.
        await this.outbox.enqueue(batch);
        this.buffer.set(topic, []);
        this.dropWarnedTopics.delete(topic);
      } catch (error) {
        console.error(`❌ [flushBuffer] Erreur outbox pour ${topic}:`, error);
      }
    }
  }

  /**
   * Réplicateur store-and-forward : lit les lignes pending de l'outbox par lots
   * et les publie vers Kafka. En cas de succès, marque les lignes synced ; en cas
   * d'échec Kafka, ne marque rien (re-tenté au prochain tick).
   */
  private startReplicator(): void {
    if (this.replicatorInterval) return;
    this.replicatorInterval = setInterval(() => {
      void this.replicate();
    }, this.replicatorIntervalMs);
  }

  private async replicate(): Promise<void> {
    if (this.isReplicating) return;
    this.isReplicating = true;
    try {
      const rows = await this.outbox.pullPending(this.replicatorBatchSize);
      if (rows.length === 0) return;
      try {
        await this.kafkaService.publishBatchSensorData(
          "sensor-data",
          rows.map((r) => r.payload),
        );
        // Succès Kafka → on marque synced
        await this.outbox.markSynced(rows.map((r) => r.id));
      } catch (error) {
        // Échec Kafka : on NE marque PAS — les lignes restent pending et seront
        // re-tentées au prochain tick (anti-perte).
        console.error("❌ [Replicator] Échec publication Kafka — re-tentative au prochain tick:", error);
      }
    } catch (error) {
      console.error("❌ [Replicator] Erreur outbox:", error);
    } finally {
      this.isReplicating = false;
    }
  }

  /**
   * Purge périodique des lignes synced plus vieilles que la rétention.
   */
  private startPurge(): void {
    if (this.purgeInterval) return;
    this.purgeInterval = setInterval(() => {
      this.outbox
        .purgeSynced(this.retentionDays)
        .then((count) => {
          if (count > 0) {
            console.log(`🧹 [Outbox] Purge: ${count} ligne(s) synced supprimée(s)`);
          }
        })
        .catch((e) => console.error("❌ [Purge] Erreur:", e));
    }, this.purgeIntervalMs);
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
      // Voie Zigbee : topics zigbee2mqtt/<device> (on ignore zigbee2mqtt/bridge/*).
      if (topic.startsWith(this.zigbeeTopicPrefix)) {
        if (!topic.startsWith(`${this.zigbeeTopicPrefix}bridge`)) {
          const payload = JSON.parse(message.toString());
          this.handleZigbeeMessage(topic, payload).catch((e) =>
            console.error("❌ [handleZigbeeMessage]", e),
          );
        }
        return;
      }

      if (!topic.endsWith(TOPICS.SENSOR)) {
        return;
      }
      // Mémorise l'ESP pour le web server de gestion (ESP only, ≠ Zigbee).
      this.knownDevices.add(topic);

      const parsed = JSON.parse(message.toString());
      if (parsed[MESSAGE_FIELDS.CMD] === COMMANDS.PING) {
        this.handlePing(topic, parsed.version);
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
