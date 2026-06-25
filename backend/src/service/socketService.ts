import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { envs } from "@utils/env";
import KafkaService from "@service/kafkaService";
import db from "@db/index";
import type { Sensor } from "#/sensor";
import type { MeasurementTypeModel } from "#/measurementType";
import type { Threshold } from "#/threshold";
import { addDiscoveredTopic } from "@service/discorverdSensorSevice";
import { addDiscoveredMeasurement } from "@service/discoverdMeasurementService";
import * as dlq from "@service/dlqService";
import {
  activeSessionsTotal,
  kafkaMessageProcessingSeconds,
} from "@middlewares/metrics";

const {
  Sensor: SensorModel,
  Session,
  MeasurementType,
  Threshold: ThresholdModel,
  UserSensorAccess,
  User,
} = db as any;

// ---------- Kafka message payload types ----------

interface KafkaMeasure {
  measureType: string;
  value: number;
}

interface KafkaDataEntry {
  timestamp: number;
  measures: KafkaMeasure[];
}

interface KafkaStartPayload {
  type: "start";
  sensorTopic: string;
  timestamp: number;
}

interface KafkaDataPayload {
  type: "data";
  sensorTopic: string;
  measures: KafkaDataEntry[];
}

interface KafkaStopPayload {
  type: "stop";
  sensorTopic: string;
  timestamp: number;
}

type KafkaPayload = KafkaStartPayload | KafkaDataPayload | KafkaStopPayload;

class SocketService {
  private io: Server;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:8080",
        credentials: true,
      },
    });
  }

  public initialize() {
    this.io.on("connection", (socket) => {
      socket.on("join-session", (data: { token: string; topic: string }) => {
        try {
          jwt.verify(data.token, envs.JWT_SECRET);
          socket.join(data.topic);
          socket.emit("joined", { topic: data.topic });
        } catch (error) {
          console.error("Invalid JWT token for socket connection:", error);
          socket.disconnect();
        }
      });

      socket.on("join-user-room", (data: { token: string }) => {
        try {
          const payload = jwt.verify(data.token, envs.JWT_SECRET) as {
            userId: string;
          };
          socket.join(`user-${payload.userId}`);
        } catch (error) {
          console.error("Invalid JWT token for join-user-room:", error);
        }
      });
    });
    // Surveillance « capteur muet » (§4.2).
    this.startWatchdog();
  }
  public sendDataToRoom(topic: string, data: KafkaPayload) {
    this.io.to(topic).emit("new-data", data);
  }
  private kafkaRetryCount = 0;
  private static readonly KAFKA_MAX_RETRIES = 10;
  private static readonly KAFKA_RETRY_BASE_MS = 1_000;
  private static readonly KAFKA_MAX_RETRY_DELAY_MS = 30_000;

  public async startKafkaConsumer(): Promise<void> {
    try {
      const kafkaService = await KafkaService.getInstance();
      if (!kafkaService) {
        throw new Error("Kafka unavailable");
      }
      kafkaService.registerTopic("sensor-data", async (data: KafkaPayload) => {
        try {
          if (data.type === "start") {
            await this.handleSessionStart(data);
          } else if (data.type === "data") {
            await this.handleSensorData(data);
          } else if (data.type === "stop") {
            await this.handleSessionStop(data);
          }
        } catch (error) {
          console.error("❌ [Kafka] Erreur traitement message:", error);
          dlq.push(data);
        }
      });
      await kafkaService.startConsuming();
      this.kafkaRetryCount = 0;
      await dlq.flush(async (data: KafkaPayload) => {
        if (data.type === "start") await this.handleSessionStart(data);
        else if (data.type === "data") await this.handleSensorData(data);
        else if (data.type === "stop") await this.handleSessionStop(data);
      });
    } catch (error) {
      this.kafkaRetryCount++;
      if (this.kafkaRetryCount > SocketService.KAFKA_MAX_RETRIES) {
        console.error(
          `❌ [Kafka] Abandon après ${SocketService.KAFKA_MAX_RETRIES} tentatives. Le service démarre sans Kafka.`
        );
        return;
      }
      const delay = Math.min(
        Math.pow(2, this.kafkaRetryCount) * SocketService.KAFKA_RETRY_BASE_MS,
        SocketService.KAFKA_MAX_RETRY_DELAY_MS
      );
      console.error(
        `❌ [Kafka] Erreur (tentative ${this.kafkaRetryCount}/${
          SocketService.KAFKA_MAX_RETRIES
        }), retry dans ${delay / 1000}s:`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      await this.startKafkaConsumer();
    }
  }
  // Map sensorTopic → sessionId pour tracker les sessions actives
  private activeSessions: Map<string, string> = new Map();
  // Watchdog « capteur muet » (§4.2) : dernière réception de données par topic,
  // topics déjà signalés silencieux (anti-spam), et la boucle de surveillance.
  private lastDataAt: Map<string, number> = new Map();
  private silentTopics: Set<string> = new Set();
  private watchdogInterval: NodeJS.Timeout | undefined;
  // Seuil de silence (ms) au-delà duquel un capteur en session est déclaré muet.
  private readonly SILENCE_THRESHOLD_MS = Number(
    process.env.SENSOR_SILENCE_THRESHOLD_MS ?? 15_000
  );
  private readonly WATCHDOG_INTERVAL_MS = Number(
    process.env.SENSOR_WATCHDOG_INTERVAL_MS ?? 5_000
  );
  // Guard against duplicate session creation for the same topic when two START messages arrive concurrently
  private sessionCreationInProgress: Set<string> = new Set();
  // Map measureType name → id
  private measurementTypesMap: Map<string, string> = new Map();

  private measurementTypesCacheTime: Date | null = null;

  private TTL = 5 * 60 * 1000; // 5 minutes

  // Cache sensor topic → Sensor (TTL partagé avec measurementTypesMap)
  private sensorTopicCache: Map<string, Sensor> = new Map();
  private sensorCacheTime: Date | null = null;

  // Cache des seuils par sensorId — TTL 2 min
  private thresholdsCache: Map<
    string,
    { data: Threshold[]; loadedAt: number }
  > = new Map();
  private THRESHOLD_TTL = 2 * 60 * 1000; // 2 minutes

  private async getMeasurementTypesMap(): Promise<void> {
    const now = new Date();
    if (
      this.measurementTypesMap.size > 0 &&
      this.measurementTypesCacheTime &&
      now.getTime() - this.measurementTypesCacheTime.getTime() < this.TTL
    )
      return;
    const types = await MeasurementType.findAll();
    types.forEach((mt: MeasurementTypeModel) => {
      this.measurementTypesMap.set(mt.dataValues.name, mt.dataValues.id);
    });
    this.measurementTypesCacheTime = now;
  }

  private async getSensorByTopic(
    baseTopic: string
  ): Promise<Sensor | undefined> {
    const now = new Date();
    if (
      this.sensorTopicCache.size > 0 &&
      this.sensorCacheTime &&
      now.getTime() - this.sensorCacheTime.getTime() < this.TTL
    ) {
      return this.sensorTopicCache.get(baseTopic);
    }
    const sensors = await SensorModel.findAll();
    this.sensorTopicCache.clear();
    sensors.forEach((s: any) => {
      const sensor = s.dataValues as Sensor;
      this.sensorTopicCache.set(sensor.topic, sensor);
    });
    this.sensorCacheTime = now;
    return this.sensorTopicCache.get(baseTopic);
  }

  private async handleSessionStart(data: KafkaStartPayload): Promise<void> {
    if (
      this.activeSessions.has(data.sensorTopic) ||
      this.sessionCreationInProgress.has(data.sensorTopic)
    ) {
      console.warn(
        `⚠️ [SessionStart] Session déjà active ou en cours de création pour: ${data.sensorTopic}`
      );
      return;
    }

    this.sessionCreationInProgress.add(data.sensorTopic);
    try {
      const baseTopic = data.sensorTopic.replace("/sensor", "");
      const sensor = await this.getSensorByTopic(baseTopic);
      if (!sensor) {
        console.warn(
          `⚠️ [SessionStart] Capteur inconnu pour topic: ${baseTopic}`
        );
        addDiscoveredTopic(baseTopic);
        return;
      }
      const session = await Session.create({
        idSensor: sensor.id,
        idFog: "fog-service",
        createdAt: new Date(data.timestamp),
      });
      this.activeSessions.set(
        data.sensorTopic,
        (session.dataValues as { id: string }).id
      );
      // Le watchdog ne doit pas déclarer muette une session qui vient de démarrer.
      this.lastDataAt.set(data.sensorTopic, Date.now());
      this.silentTopics.delete(data.sensorTopic);
      activeSessionsTotal.inc();
      console.log(
        `▶️ [Session] Créée pour ${baseTopic} — id: ${session.dataValues.id}`
      );
    } finally {
      this.sessionCreationInProgress.delete(data.sensorTopic);
    }
  }

  private async handleSensorData(data: KafkaDataPayload): Promise<void> {
    const startTime = process.hrtime();
    // Le capteur émet : on rafraîchit le watchdog et, s'il était muet, on
    // notifie la reprise du signal (§4.2).
    this.lastDataAt.set(data.sensorTopic, Date.now());
    if (this.silentTopics.delete(data.sensorTopic)) {
      this.io.to(data.sensorTopic).emit("sensor-recovered", {
        sensorTopic: data.sensorTopic,
        recoveredAt: new Date().toISOString(),
      });
    }
    await this.getMeasurementTypesMap();
    const sessionId = this.activeSessions.get(data.sensorTopic);
    if (!sessionId) {
      console.warn(
        `⚠️ [SensorData] Pas de session active pour: ${data.sensorTopic}`
      );
      return;
    }
    const baseTopic = data.sensorTopic.replace("/sensor", "");
    const sensor = await this.getSensorByTopic(baseTopic);
    if (!sensor) {
      addDiscoveredTopic(baseTopic);
      return;
    }

    // Collecter toutes les lignes en une passe synchrone
    type AlertItem = {
      idMeasurementType: string;
      measureType: string;
      value: number;
    };
    const rows: Array<{
      time: Date;
      idSensor: string;
      idMeasurementType: string;
      value: number;
    }> = [];
    const alerts: AlertItem[] = [];

    for (const entry of data.measures) {
      for (const measure of entry.measures) {
        const idMeasurementType = this.measurementTypesMap.get(
          measure.measureType
        );
        if (!idMeasurementType) {
          addDiscoveredMeasurement(measure.measureType);
          console.warn(
            `⚠️ [SensorData] Type de mesure inconnu: ${measure.measureType}`
          );
          continue;
        }
        rows.push({
          time: new Date(Math.floor(entry.timestamp / 1000)),
          idSensor: sensor.id,
          idMeasurementType,
          value: measure.value,
        });
        alerts.push({
          idMeasurementType,
          measureType: measure.measureType,
          value: measure.value,
        });
      }
    }

    // Un seul aller-retour DB pour toutes les lignes du batch
    if (rows.length > 0) {
      await db.sensordata.bulkCreate(rows, { ignoreDuplicates: true });
    }

    // Checks d'alertes après l'insertion
    for (const alert of alerts) {
      await this.checkAndEmitAlerts(
        sensor.id,
        alert.idMeasurementType,
        alert.measureType,
        alert.value,
        data.sensorTopic
      );
    }

    const [seconds, nanoseconds] = process.hrtime(startTime);
    kafkaMessageProcessingSeconds.observe(seconds + nanoseconds / 1e9);
    this.sendDataToRoom(data.sensorTopic, data);
  }

  private async getThresholdsForSensor(idSensor: string): Promise<Threshold[]> {
    const cached = this.thresholdsCache.get(idSensor);
    if (cached && Date.now() - cached.loadedAt < this.THRESHOLD_TTL) {
      return cached.data;
    }
    const rows = await ThresholdModel.findAll({ where: { idSensor } });
    const data: Threshold[] = rows.map((r: any) => r.dataValues as Threshold);
    this.thresholdsCache.set(idSensor, { data, loadedAt: Date.now() });
    return data;
  }

  private async checkAndEmitAlerts(
    idSensor: string,
    idMeasurementType: string,
    measureType: string,
    value: number,
    sensorTopic: string
  ): Promise<void> {
    const thresholds = await this.getThresholdsForSensor(idSensor);
    const threshold = thresholds.find(
      (t) => t.idMeasurementType === idMeasurementType
    );
    if (!threshold) return;

    const violations: Array<{ direction: "min" | "max"; limit: number }> = [];
    if (
      threshold.minValue !== undefined &&
      threshold.minValue !== null &&
      value < threshold.minValue
    ) {
      violations.push({ direction: "min", limit: threshold.minValue });
    }
    if (
      threshold.maxValue !== undefined &&
      threshold.maxValue !== null &&
      value > threshold.maxValue
    ) {
      violations.push({ direction: "max", limit: threshold.maxValue });
    }
    if (violations.length === 0) return;

    const [accesses, admins] = await Promise.all([
      UserSensorAccess.findAll({
        where: { sensorId: idSensor, status: "accepted" },
      }),
      User.findAll({ where: { role: "admin" }, attributes: ["id"] }),
    ]);
    const accessUserIds = new Set<string>(
      accesses.map((a: any) => (a.dataValues as any).userId)
    );
    for (const admin of admins) {
      accessUserIds.add((admin.dataValues as any).id);
    }
    for (const violation of violations) {
      for (const userId of accessUserIds) {
        this.io.to(`user-${userId}`).emit("threshold-alert", {
          sensorTopic,
          measureType,
          value,
          minValue: threshold.minValue,
          maxValue: threshold.maxValue,
          direction: violation.direction,
          triggeredAt: new Date().toISOString(),
        });
      }
    }
  }

  private async handleSessionStop(data: KafkaStopPayload): Promise<void> {
    const sessionId = this.activeSessions.get(data.sensorTopic);
    if (!sessionId) return;
    await Session.update(
      { endedAt: new Date(data.timestamp) },
      { where: { id: sessionId } }
    );
    this.activeSessions.delete(data.sensorTopic);
    this.lastDataAt.delete(data.sensorTopic);
    this.silentTopics.delete(data.sensorTopic);
    activeSessionsTotal.dec();
    console.log(`⏹️ [Session] Clôturée pour ${data.sensorTopic}`);
  }

  /**
   * Démarre la surveillance « capteur muet » (§4.2) : en monitoring
   * physiologique, l'absence prolongée de signal (ECG) est une urgence. Pour
   * chaque session active sans données depuis SILENCE_THRESHOLD_MS, on émet
   * `sensor-silent` (une fois) vers la room du topic.
   */
  public startWatchdog(): void {
    if (this.watchdogInterval) return;
    this.watchdogInterval = setInterval(
      () => this.checkSilentSensors(),
      this.WATCHDOG_INTERVAL_MS
    );
  }

  public stopWatchdog(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = undefined;
    }
  }

  // Exposé pour les tests : un passage de surveillance.
  public checkSilentSensors(now: number = Date.now()): void {
    for (const [topic] of this.activeSessions) {
      if (this.silentTopics.has(topic)) continue;
      const last = this.lastDataAt.get(topic) ?? 0;
      if (now - last > this.SILENCE_THRESHOLD_MS) {
        this.silentTopics.add(topic);
        const silentForMs = last === 0 ? null : now - last;
        console.warn(`🔇 [Watchdog] Capteur muet: ${topic}`);
        this.io.to(topic).emit("sensor-silent", {
          sensorTopic: topic,
          silentForMs,
          detectedAt: new Date(now).toISOString(),
        });
      }
    }
  }

  public emitSensorStatus(sensorName: string, status: string) {
    this.io.emit("sensor-status", { sensorName, status });
  }

  public async close(): Promise<void> {
    this.stopWatchdog();
    const now = new Date();
    for (const [, sessionId] of this.activeSessions) {
      await Session.update({ endedAt: now }, { where: { id: sessionId } });
    }
    console.log(
      `${this.activeSessions.size} session(s) clôturée(s) au shutdown`
    );
    activeSessionsTotal.set(0);
    this.activeSessions.clear();
    this.io.close();
    const kafkaService = await KafkaService.getInstance();
    if (kafkaService) {
      await kafkaService.disconnect();
    }
    console.log("SocketService fermé proprement");
  }
}

export default SocketService;
