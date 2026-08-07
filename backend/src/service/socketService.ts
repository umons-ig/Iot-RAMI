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
import { userHasSensorAccess } from "@service/sensorAccess";
import { Role, UserPayload } from "#/user";
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
      socket.on(
        "join-session",
        async (data: { token: string; topic: string }) => {
          let payload: UserPayload;
          try {
            payload = jwt.verify(data.token, envs.JWT_SECRET) as UserPayload;
          } catch (error) {
            console.error("Invalid JWT token for socket connection:", error);
            socket.disconnect();
            return;
          }

          // Le JWT prouve l'IDENTITÉ, pas le DROIT d'écouter ce capteur. Sans le
          // contrôle ci-dessous, tout compte authentifié pouvait rejoindre la
          // room d'un topic arbitraire et recevoir l'ECG temps réel d'un autre
          // patient — le canal WebSocket contournait entièrement le contrôle
          // d'accès appliqué côté REST (`requireSessionAccess`).
          try {
            if (!(await this.userMayJoinTopic(payload, data.topic))) {
              socket.emit("error", {
                message: "You do not have access to this sensor",
                code: "sensor.access.forbidden",
              });
              return; // refus ciblé : le socket garde ses rooms légitimes
            }
          } catch (error) {
            console.error("[join-session] access check failed:", error);
            socket.emit("error", {
              message: "Access check failed",
              code: "sensor.access.error",
            });
            return; // fail-closed
          }

          // On conserve le JETON, pas le payload décodé : la revalidation le
          // re-vérifie, ce qui fait aussi expirer les sockets dont le JWT n'est
          // plus valable et prend en compte un changement de rôle. Garder le
          // payload figé aurait maintenu un socket ouvert indéfiniment avec les
          // droits qu'il avait au moment du join.
          (socket.data as any).authToken = data.token;
          socket.join(data.topic);
          socket.emit("joined", { topic: data.topic });
        }
      );

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
    // Coupe le flux des sockets dont l'accès capteur a été retiré entre-temps.
    this.startAccessRevalidation();
  }
  public sendDataToRoom(topic: string, data: KafkaPayload) {
    this.io.to(topic).emit("new-data", data);
  }
  private kafkaRetryCount = 0;
  private kafkaRestarting = false;
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
      // Reconnexion auto sur crash non récupérable : on recrée un consumer neuf
      // et on relance (avec le backoff de cette même méthode). Cf. §1.2.
      kafkaService.onCrash?.(() => {
        if (this.kafkaRestarting) return;
        this.kafkaRestarting = true;
        console.error(
          "❌ [Kafka] Crash non récupérable — redémarrage du consumer"
        );
        KafkaService.reset();
        this.kafkaRetryCount = 0;
        void this.startKafkaConsumer().finally(() => {
          this.kafkaRestarting = false;
        });
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
  private accessRevalidationInterval: NodeJS.Timeout | undefined;
  // Fenêtre pendant laquelle un accès révoqué reste effectif sur un socket ouvert.
  private readonly ACCESS_REVALIDATION_MS = 60_000;
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

  // Destinataires d'alerte mis en cache par capteur (TTL) pour éviter 2 requêtes
  // DB par mesure en violation (N+1). Cf. PLAN_AMELIORATIONS §2.9.
  private recipientsCache: Map<string, { ids: string[]; loadedAt: number }> =
    new Map();
  private RECIPIENTS_TTL = 2 * 60 * 1000; // 2 minutes

  // État d'alerte courant par (capteur:typeMesure) pour l'anti-flapping :
  // on n'émet qu'au CHANGEMENT d'état, pas à chaque point hors bornes. §2.9
  private alertState: Map<string, "min" | "max" | "ok"> = new Map();

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

  /**
   * Autorisation d'écoute d'une room WebSocket. La room porte le topic capteur
   * complet (`<nom>/sensor`, cf. `sendDataToRoom(data.sensorTopic)`) alors que
   * les capteurs sont enregistrés sous leur topic de base : on normalise avant
   * lookup, en ne retirant `/sensor` QU'EN SUFFIXE (un `replace` simple aurait
   * amputé un topic légitime du type `batimentA/sensors/ecg-12`).
   *
   * Le lookup ne passe PAS par `getSensorByTopic` : ce cache à TTL 5 min sert la
   * voie de données, et un capteur enregistré il y a moins de 5 minutes en est
   * absent — un utilisateur pourtant autorisé se serait vu refuser le flux
   * jusqu'à l'expiration du cache. Une décision d'autorisation se prend sur
   * l'état courant de la base.
   *
   * Fail-closed : un topic qui ne correspond à aucun capteur enregistré (topic
   * seulement auto-découvert, ou forgé par le client) est refusé aux non-admins.
   */
  private async userMayJoinTopic(
    payload: UserPayload,
    topic: string
  ): Promise<boolean> {
    if (payload?.role === Role.ADMIN) return true;
    if (!payload?.userId || typeof topic !== "string" || !topic) return false;

    const SUFFIX = "/sensor";
    const baseTopic = topic.endsWith(SUFFIX)
      ? topic.slice(0, -SUFFIX.length)
      : topic;
    if (!baseTopic) return false;

    const sensor = await SensorModel.findOne({ where: { topic: baseTopic } });
    const sensorId = sensor?.dataValues?.id ?? (sensor as any)?.id;
    if (!sensorId) return false;

    return userHasSensorAccess(payload.userId, sensorId);
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

  // Les mesures capteur sont horodatées en MICROSECONDES (simulateur/ESP32 :
  // time*1e6). On normalise en ms et on rejette les valeurs aberrantes (capteur
  // mal configuré émettant en ms -> dates en 1970, ou horloge dans le futur).
  // Cf. PLAN_AMELIORATIONS §1.4 et docs/KAFKA.md.
  private static readonly MIN_VALID_MS = Date.UTC(2020, 0, 1);
  private normalizeTimestampMicros(micros: number): number | null {
    if (typeof micros !== "number" || !Number.isFinite(micros)) return null;
    const ms = Math.floor(micros / 1000);
    const maxValidMs = Date.now() + 24 * 60 * 60 * 1000; // tolérance +1 jour
    if (ms < SocketService.MIN_VALID_MS || ms > maxValidMs) return null;
    return ms;
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
      const timeMs = this.normalizeTimestampMicros(entry.timestamp);
      if (timeMs === null) {
        console.warn(
          `⚠️ [SensorData] Timestamp hors plage ignoré: ${entry.timestamp} (topic ${data.sensorTopic})`
        );
        continue;
      }
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
          time: new Date(timeMs),
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
    // Anti-flapping : on ne notifie qu'au CHANGEMENT d'état (entrée en
    // violation ou bascule min<->max), pas à chaque point hors bornes. Un
    // capteur durablement hors limites n'émet donc qu'une alerte, pas une par
    // mesure. L'état est mis à jour même au retour dans les bornes pour
    // permettre une nouvelle alerte ultérieure. §2.9
    const newState: "min" | "max" | "ok" = violations.some(
      (v) => v.direction === "min"
    )
      ? "min"
      : violations.some((v) => v.direction === "max")
      ? "max"
      : "ok";
    const key = `${idSensor}:${idMeasurementType}`;
    const prevState = this.alertState.get(key) ?? "ok";
    if (newState === prevState) return;
    this.alertState.set(key, newState);
    if (newState === "ok") return; // retour dans les bornes : juste un reset

    const recipients = await this.getAlertRecipients(idSensor);
    for (const userId of recipients) {
      this.io.to(`user-${userId}`).emit("threshold-alert", {
        sensorTopic,
        measureType,
        value,
        minValue: threshold.minValue,
        maxValue: threshold.maxValue,
        direction: newState,
        triggeredAt: new Date().toISOString(),
      });
    }
  }

  // Destinataires d'une alerte capteur (accès direct ∪ admins), mis en cache
  // par capteur avec TTL pour éviter le N+1. §2.9
  private async getAlertRecipients(idSensor: string): Promise<string[]> {
    const cached = this.recipientsCache.get(idSensor);
    if (cached && Date.now() - cached.loadedAt < this.RECIPIENTS_TTL) {
      return cached.ids;
    }
    const [accesses, admins] = await Promise.all([
      UserSensorAccess.findAll({
        where: { sensorId: idSensor, status: "accepted" },
      }),
      User.findAll({ where: { role: "admin" }, attributes: ["id"] }),
    ]);
    const ids = new Set<string>(
      accesses.map((a: any) => (a.dataValues as any).userId)
    );
    for (const admin of admins) {
      ids.add((admin.dataValues as any).id);
    }
    const arr = Array.from(ids);
    this.recipientsCache.set(idSensor, { ids: arr, loadedAt: Date.now() });
    return arr;
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

  /**
   * Revalide périodiquement l'autorisation des sockets déjà dans une room.
   *
   * L'autorisation est évaluée au `join`, mais un socket vit longtemps : sans
   * cette boucle, un opérateur à qui l'on RETIRE l'accès à un capteur continuait
   * de recevoir son ECG tant qu'il gardait l'onglet ouvert.
   */
  public startAccessRevalidation(): void {
    if (this.accessRevalidationInterval) return;
    this.accessRevalidationInterval = setInterval(
      () => {
        this.revalidateSocketAccess().catch((error) =>
          console.error("[access-revalidation] échec:", error)
        );
      },
      this.ACCESS_REVALIDATION_MS
    );
  }

  public stopAccessRevalidation(): void {
    if (this.accessRevalidationInterval) {
      clearInterval(this.accessRevalidationInterval);
      this.accessRevalidationInterval = undefined;
    }
  }

  // Exposé pour les tests : un passage de revalidation.
  public async revalidateSocketAccess(): Promise<void> {
    const sockets = await this.io.fetchSockets();
    for (const socket of sockets) {
      const token = (socket.data as any)?.authToken as string | undefined;
      if (!token) continue;

      // Re-vérification du jeton : couvre l'expiration et un rôle modifié
      // depuis le join. Un jeton devenu invalide fait quitter toutes les rooms.
      let payload: UserPayload;
      try {
        payload = jwt.verify(token, envs.JWT_SECRET) as UserPayload;
      } catch {
        for (const room of socket.rooms) {
          if (room === socket.id || room.startsWith("user-")) continue;
          socket.leave(room);
        }
        socket.emit("error", {
          message: "Session expired, please reconnect",
          code: "auth.token.expired",
        });
        continue;
      }

      for (const room of socket.rooms) {
        // socket.io place l'id du socket dans ses rooms, et `user-<id>` ne
        // dépend que du token : ni l'un ni l'autre n'est une room de capteur.
        if (room === socket.id || room.startsWith("user-")) continue;

        const stillAllowed = await this.userMayJoinTopic(payload, room).catch(
          () => false // fail-closed
        );
        if (!stillAllowed) {
          socket.leave(room);
          socket.emit("error", {
            message: "Your access to this sensor has been revoked",
            code: "sensor.access.forbidden",
          });
          console.warn(
            `[access-revalidation] accès révoqué pour ${payload.userId} sur ${room}`
          );
        }
      }
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
    this.stopAccessRevalidation();
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
