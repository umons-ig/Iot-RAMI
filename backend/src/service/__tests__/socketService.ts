import { createServer } from "http";
import SocketService from "@service/socketService";
import db from "@db/index";
import KafkaService from "@service/kafkaService";
import * as discoveredMeasurementService from "@service/discoverdMeasurementService";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@db/index", () => ({
  Sensor: { findAll: jest.fn() },
  Session: { create: jest.fn(), update: jest.fn() },
  MeasurementType: { findAll: jest.fn() },
  sensordata: { bulkCreate: jest.fn() },
  Threshold: { findAll: jest.fn() },
  UserSensorAccess: { findAll: jest.fn() },
  User: { findAll: jest.fn() },
}));

jest.mock("@service/kafkaService", () => ({
  __esModule: true,
  default: { getInstance: jest.fn() },
}));

jest.mock("@service/discorverdSensorSevice", () => ({
  addDiscoveredTopic: jest.fn(),
  discoveredTopics: new Map(),
}));

jest.mock("@service/discoverdMeasurementService", () => ({
  addDiscoveredMeasurement: jest.fn(),
  discoveredMeasurements: new Map(),
}));

jest.mock("@service/dlqService", () => ({
  push: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@middlewares/metrics", () => ({
  activeSessionsTotal: { inc: jest.fn(), dec: jest.fn(), set: jest.fn() },
  kafkaMessageProcessingSeconds: { observe: jest.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const makeSensorRow = (topic: string) => ({
  dataValues: { id: "sensor-uuid", name: "sensor1", topic },
});

const sensorRow = makeSensorRow("test/topic");

const sessionRow = {
  dataValues: { id: "session-uuid" },
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SocketService", () => {
  let service: SocketService;

  beforeEach(() => {
    service = new SocketService(createServer());
    jest.clearAllMocks();
    // Reset internal state between tests
    (service as any).activeSessions = new Map();
    (service as any).sessionCreationInProgress = new Set();
    (service as any).measurementTypesMap = new Map();
    (service as any).kafkaRetryCount = 0;
    (service as any).measurementTypesCacheTime = null;
    (service as any).sensorTopicCache = new Map();
    (service as any).sensorCacheTime = null;
  });

  // ── handleSessionStart ───────────────────────────────────────────────────

  describe("handleSessionStart", () => {
    it("creates a session when sensor is found", async () => {
      (db.Sensor.findAll as jest.Mock).mockResolvedValue([sensorRow]);
      (db.Session.create as jest.Mock).mockResolvedValue(sessionRow);

      await (service as any).handleSessionStart({
        type: "start",
        sensorTopic: "test/topic/sensor",
        timestamp: Date.now(),
      });

      expect(db.Session.create).toHaveBeenCalledTimes(1);
      expect((service as any).activeSessions.get("test/topic/sensor")).toBe(
        "session-uuid"
      );
    });

    it("skips creation when sensor is not found", async () => {
      (db.Sensor.findAll as jest.Mock).mockResolvedValue([]);

      await (service as any).handleSessionStart({
        type: "start",
        sensorTopic: "unknown/sensor",
        timestamp: Date.now(),
      });

      expect(db.Session.create).not.toHaveBeenCalled();
    });

    it("prevents duplicate sessions when two START messages arrive concurrently for the same topic", async () => {
      // Use a manually-controlled Promise to simulate DB latency.
      // Both calls enter handleSessionStart before the first one completes,
      // which is exactly the race condition the guard defends against.
      let resolveFindAll!: (val: unknown) => void;
      const findAllPromise = new Promise((resolve) => {
        resolveFindAll = resolve;
      });
      (db.Sensor.findAll as jest.Mock).mockReturnValue(findAllPromise);
      (db.Session.create as jest.Mock).mockResolvedValue(sessionRow);

      const payload = {
        type: "start" as const,
        sensorTopic: "test/topic/sensor",
        timestamp: Date.now(),
      };

      // Fire both calls before the DB responds
      const p1 = (service as any).handleSessionStart(payload);
      const p2 = (service as any).handleSessionStart(payload);

      // Now let the DB respond
      resolveFindAll([sensorRow]);

      await Promise.all([p1, p2]);

      expect(db.Session.create).toHaveBeenCalledTimes(1);
    });

    it("allows a new session for a different topic to proceed in parallel", async () => {
      (db.Sensor.findAll as jest.Mock).mockResolvedValue([
        makeSensorRow("topic-a"),
        makeSensorRow("topic-b"),
      ]);
      (db.Session.create as jest.Mock).mockResolvedValue(sessionRow);

      await Promise.all([
        (service as any).handleSessionStart({
          type: "start",
          sensorTopic: "topic-a/sensor",
          timestamp: Date.now(),
        }),
        (service as any).handleSessionStart({
          type: "start",
          sensorTopic: "topic-b/sensor",
          timestamp: Date.now(),
        }),
      ]);

      expect(db.Session.create).toHaveBeenCalledTimes(2);
    });

    it("skips if a session already exists for the topic", async () => {
      (service as any).activeSessions.set(
        "test/topic/sensor",
        "existing-session"
      );

      await (service as any).handleSessionStart({
        type: "start",
        sensorTopic: "test/topic/sensor",
        timestamp: Date.now(),
      });

      expect(db.Sensor.findAll).not.toHaveBeenCalled();
      expect(db.Session.create).not.toHaveBeenCalled();
    });
  });

  // ── handleSessionStop ────────────────────────────────────────────────────

  describe("handleSessionStop", () => {
    it("closes the session and removes it from the active map", async () => {
      (service as any).activeSessions.set("test/topic/sensor", "session-uuid");
      (db.Session.update as jest.Mock).mockResolvedValue([1]);

      await (service as any).handleSessionStop({
        type: "stop",
        sensorTopic: "test/topic/sensor",
        timestamp: Date.now(),
      });

      expect(db.Session.update).toHaveBeenCalledWith(
        { endedAt: expect.any(Date) },
        { where: { id: "session-uuid" } }
      );
      expect((service as any).activeSessions.has("test/topic/sensor")).toBe(
        false
      );
    });

    it("does nothing when there is no active session for the topic", async () => {
      await (service as any).handleSessionStop({
        type: "stop",
        sensorTopic: "no-session/sensor",
        timestamp: Date.now(),
      });

      expect(db.Session.update).not.toHaveBeenCalled();
    });
  });

  describe("getMeasurementTypesMap", () => {
    it("ne recharge pas le cache si le TTL n'est pas expiré", async () => {
      (db.MeasurementType.findAll as jest.Mock).mockResolvedValue([
        { dataValues: { name: "ecg", id: "type-uuid" } },
      ]);

      await (service as any).getMeasurementTypesMap();
      await (service as any).getMeasurementTypesMap();

      expect(db.MeasurementType.findAll).toHaveBeenCalledTimes(1);
    });

    it("recharge le cache si le TTL est expiré", async () => {
      (db.MeasurementType.findAll as jest.Mock).mockResolvedValue([
        { dataValues: { name: "ecg", id: "type-uuid" } },
      ]);

      await (service as any).getMeasurementTypesMap();

      (service as any).measurementTypesCacheTime = new Date(
        Date.now() - 300100
      );

      await (service as any).getMeasurementTypesMap();

      expect(db.MeasurementType.findAll).toHaveBeenCalledTimes(2);
    });
  });

  // ── startKafkaConsumer ───────────────────────────────────────────────────

  describe("startKafkaConsumer", () => {
    it("stops retrying after KAFKA_MAX_RETRIES attempts and does not throw", async () => {
      (KafkaService.getInstance as jest.Mock).mockRejectedValue(
        new Error("Kafka unavailable")
      );

      // Replace setTimeout so retries execute without real delays
      const setTimeoutSpy = jest
        .spyOn(global, "setTimeout")
        .mockImplementation((fn) => {
          (fn as () => void)();
          return 0 as unknown as NodeJS.Timeout;
        });

      await service.startKafkaConsumer();

      // 1 initial attempt + KAFKA_MAX_RETRIES (10) retries = 11 total
      expect(KafkaService.getInstance).toHaveBeenCalledTimes(11);

      setTimeoutSpy.mockRestore();
    });

    it("resets retry count on success", async () => {
      const kafkaMock = {
        registerTopic: jest.fn(),
        startConsuming: jest.fn().mockResolvedValue(undefined),
        onCrash: jest.fn(),
      };
      (KafkaService.getInstance as jest.Mock).mockResolvedValue(kafkaMock);

      await service.startKafkaConsumer();

      expect((service as any).kafkaRetryCount).toBe(0);
      // Le handler de reconnexion sur crash est enregistré (cf. §1.2).
      expect(kafkaMock.onCrash).toHaveBeenCalledTimes(1);
    });
  });

  // ── handleSensorData ─────────────────────────────────────────────────────

  describe("handleSensorData", () => {
    const sensorId = "sensor-uuid";
    const baseTopic = "sensor-test";
    const sensorTopic = "sensor-test/sensor";

    const dataPayload = {
      type: "data" as const,
      sensorTopic,
      measures: [
        {
          timestamp: Date.now() * 1000,
          measures: [{ measureType: "temperature", value: 25.5 }],
        },
      ],
    };

    beforeEach(() => {
      // Session active pour le topic
      (service as any).activeSessions.set(sensorTopic, "session-uuid");

      // Cache sensor
      (service as any).sensorTopicCache.set(baseTopic, {
        id: sensorId,
        name: "sensor-test",
        topic: baseTopic,
      });
      (service as any).sensorCacheTime = new Date();

      // Cache measurementTypes
      (service as any).measurementTypesMap.set("temperature", "type-uuid-temp");
      (service as any).measurementTypesCacheTime = new Date();

      // Thresholds vides par défaut
      (db as any).Threshold.findAll = jest.fn().mockResolvedValue([]);

      // bulkCreate OK
      (db.sensordata.bulkCreate as jest.Mock).mockResolvedValue([]);
    });

    it("appelle bulkCreate avec les bonnes lignes quand la session est active", async () => {
      await (service as any).handleSensorData(dataPayload);

      expect(db.sensordata.bulkCreate).toHaveBeenCalledTimes(1);
      expect(db.sensordata.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            idSensor: sensorId,
            idMeasurementType: "type-uuid-temp",
            value: 25.5,
          }),
        ]),
        { ignoreDuplicates: true }
      );
    });

    it("appelle addDiscoveredMeasurement et ne plante pas si le type de mesure est inconnu", async () => {
      const payloadUnknownType = {
        ...dataPayload,
        measures: [
          {
            timestamp: Date.now() * 1000,
            measures: [{ measureType: "unknown-type", value: 99 }],
          },
        ],
      };

      await (service as any).handleSensorData(payloadUnknownType);

      expect(
        discoveredMeasurementService.addDiscoveredMeasurement
      ).toHaveBeenCalledWith("unknown-type");
      // Aucune ligne à insérer → bulkCreate non appelé
      expect(db.sensordata.bulkCreate).not.toHaveBeenCalled();
    });

    it("ignore une entrée dont le timestamp est hors plage (capteur en ms au lieu de µs)", async () => {
      // Un capteur mal configuré émettant en millisecondes : /1000 -> ~1970.
      const payloadBadTs = {
        ...dataPayload,
        measures: [
          {
            timestamp: Date.now(), // ms au lieu de µs -> date en 1970 après /1000
            measures: [{ measureType: "temperature", value: 25.5 }],
          },
        ],
      };

      const warnSpy = jest
        .spyOn(console, "warn")
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        .mockImplementation(() => {});

      await (service as any).handleSensorData(payloadBadTs);

      expect(db.sensordata.bulkCreate).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("log un warning et retourne sans bulkCreate si pas de session active", async () => {
      (service as any).activeSessions = new Map();

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await (service as any).handleSensorData(dataPayload);

      expect(db.sensordata.bulkCreate).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(sensorTopic)
      );

      warnSpy.mockRestore();
    });

    it("appelle sendDataToRoom avec le bon topic après insertion", async () => {
      const sendDataToRoomSpy = jest
        .spyOn(service, "sendDataToRoom")
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        .mockImplementation(() => {});

      await (service as any).handleSensorData(dataPayload);

      expect(sendDataToRoomSpy).toHaveBeenCalledWith(sensorTopic, dataPayload);

      sendDataToRoomSpy.mockRestore();
    });
  });

  // ── checkAndEmitAlerts ───────────────────────────────────────────────────

  describe("checkAndEmitAlerts", () => {
    const sensorId = "sensor-uuid";
    const measurementTypeId = "type-uuid-temp";
    const measureType = "temperature";
    const sensorTopic = "sensor-test/sensor";

    // Accès io interne pour vérifier les émissions
    let emitMock: jest.Mock;
    let toMock: jest.Mock;

    beforeEach(() => {
      // Reset cache thresholds entre chaque test
      (service as any).thresholdsCache = new Map();

      emitMock = jest.fn();
      toMock = jest.fn().mockReturnValue({ emit: emitMock });
      (service as any).io = { to: toMock };
    });

    it("retourne sans émettre si aucun threshold n'existe pour ce capteur", async () => {
      (db as any).Threshold.findAll = jest.fn().mockResolvedValue([]);

      await (service as any).checkAndEmitAlerts(
        sensorId,
        measurementTypeId,
        measureType,
        25.5,
        sensorTopic
      );

      expect(toMock).not.toHaveBeenCalled();
    });

    it("émet threshold-alert à l'utilisateur concerné quand la valeur est sous le min", async () => {
      (db as any).Threshold.findAll = jest.fn().mockResolvedValue([
        {
          dataValues: {
            idSensor: sensorId,
            idMeasurementType: measurementTypeId,
            minValue: 20,
            maxValue: 100,
          },
        },
      ]);
      (db as any).UserSensorAccess.findAll = jest
        .fn()
        .mockResolvedValue([{ dataValues: { userId: "user-uuid-1" } }]);
      (db as any).User.findAll = jest.fn().mockResolvedValue([]);

      await (service as any).checkAndEmitAlerts(
        sensorId,
        measurementTypeId,
        measureType,
        10, // < minValue 20
        sensorTopic
      );

      expect(toMock).toHaveBeenCalledWith("user-user-uuid-1");
      expect(emitMock).toHaveBeenCalledWith(
        "threshold-alert",
        expect.objectContaining({
          direction: "min",
          sensorTopic,
          measureType,
          value: 10,
        })
      );
    });

    it("émet threshold-alert à l'utilisateur concerné quand la valeur dépasse le max", async () => {
      (db as any).Threshold.findAll = jest.fn().mockResolvedValue([
        {
          dataValues: {
            idSensor: sensorId,
            idMeasurementType: measurementTypeId,
            minValue: 0,
            maxValue: 30,
          },
        },
      ]);
      (db as any).UserSensorAccess.findAll = jest
        .fn()
        .mockResolvedValue([{ dataValues: { userId: "user-uuid-1" } }]);
      (db as any).User.findAll = jest.fn().mockResolvedValue([]);

      await (service as any).checkAndEmitAlerts(
        sensorId,
        measurementTypeId,
        measureType,
        50, // > maxValue 30
        sensorTopic
      );

      expect(toMock).toHaveBeenCalledWith("user-user-uuid-1");
      expect(emitMock).toHaveBeenCalledWith(
        "threshold-alert",
        expect.objectContaining({
          direction: "max",
          value: 50,
        })
      );
    });

    it("n'émet qu'une fois tant que l'état d'alerte ne change pas (anti-flapping §2.9)", async () => {
      (db as any).Threshold.findAll = jest.fn().mockResolvedValue([
        {
          dataValues: {
            idSensor: sensorId,
            idMeasurementType: measurementTypeId,
            minValue: 20,
            maxValue: 100,
          },
        },
      ]);
      (db as any).UserSensorAccess.findAll = jest
        .fn()
        .mockResolvedValue([{ dataValues: { userId: "user-uuid-1" } }]);
      (db as any).User.findAll = jest.fn().mockResolvedValue([]);

      // 3 points consécutifs sous le min -> une seule émission.
      await (service as any).checkAndEmitAlerts(
        sensorId,
        measurementTypeId,
        measureType,
        10,
        sensorTopic
      );
      await (service as any).checkAndEmitAlerts(
        sensorId,
        measurementTypeId,
        measureType,
        9,
        sensorTopic
      );
      await (service as any).checkAndEmitAlerts(
        sensorId,
        measurementTypeId,
        measureType,
        8,
        sensorTopic
      );

      expect(emitMock).toHaveBeenCalledTimes(1);
    });

    it("ne émet aucune alerte si la valeur est dans les limites", async () => {
      (db as any).Threshold.findAll = jest.fn().mockResolvedValue([
        {
          dataValues: {
            idSensor: sensorId,
            idMeasurementType: measurementTypeId,
            minValue: 0,
            maxValue: 100,
          },
        },
      ]);

      await (service as any).checkAndEmitAlerts(
        sensorId,
        measurementTypeId,
        measureType,
        50, // dans les limites
        sensorTopic
      );

      expect(toMock).not.toHaveBeenCalled();
    });

    it("utilise le cache des thresholds : Threshold.findAll appelé une seule fois pour deux appels consécutifs", async () => {
      (db as any).Threshold.findAll = jest.fn().mockResolvedValue([]);
      (db as any).UserSensorAccess.findAll = jest.fn().mockResolvedValue([]);
      (db as any).User.findAll = jest.fn().mockResolvedValue([]);

      await (service as any).checkAndEmitAlerts(
        sensorId,
        measurementTypeId,
        measureType,
        25,
        sensorTopic
      );
      await (service as any).checkAndEmitAlerts(
        sensorId,
        measurementTypeId,
        measureType,
        30,
        sensorTopic
      );

      expect((db as any).Threshold.findAll).toHaveBeenCalledTimes(1);
    });
  });

  // ── watchdog « capteur muet » (§4.2) ─────────────────────────────────────
  describe("checkSilentSensors", () => {
    let emitMock: jest.Mock;
    let toMock: jest.Mock;
    const topic = "sensor-test/sensor";

    beforeEach(() => {
      emitMock = jest.fn();
      toMock = jest.fn().mockReturnValue({ emit: emitMock });
      (service as any).io = { to: toMock };
      (service as any).activeSessions = new Map([[topic, "session-uuid"]]);
      (service as any).lastDataAt = new Map();
      (service as any).silentTopics = new Set();
    });

    it("émet sensor-silent quand aucune donnée depuis le seuil", () => {
      const now = 1_000_000;
      (service as any).lastDataAt.set(topic, now - 20_000); // 20s > seuil 15s

      (service as any).checkSilentSensors(now);

      expect(toMock).toHaveBeenCalledWith(topic);
      expect(emitMock).toHaveBeenCalledWith(
        "sensor-silent",
        expect.objectContaining({ sensorTopic: topic })
      );
    });

    it("n'émet pas tant que le seuil n'est pas dépassé", () => {
      const now = 1_000_000;
      (service as any).lastDataAt.set(topic, now - 5_000); // 5s < seuil

      (service as any).checkSilentSensors(now);

      expect(emitMock).not.toHaveBeenCalled();
    });

    it("n'émet qu'une seule fois tant que le capteur reste muet (anti-spam)", () => {
      const now = 1_000_000;
      (service as any).lastDataAt.set(topic, now - 20_000);

      (service as any).checkSilentSensors(now);
      (service as any).checkSilentSensors(now + 5_000);

      expect(emitMock).toHaveBeenCalledTimes(1);
    });
  });
});
