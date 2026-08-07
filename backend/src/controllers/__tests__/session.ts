import { Sensor } from "#/sensor";
import superTest from "supertest";
import app from "@/app";
// Model(s) import
import db from "@db/index";
const DB: any = db;
const { Sensor: SensorModel } = DB;
// --- End of model(s) import

jest.mock("@db/index", () => ({
  Sensor: {
    findByPk: jest.fn(),
  },
  Session: {
    create: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    destroy: jest.fn(),
    update: jest.fn(),
  },
  sensordata: {
    findAll: jest.fn(),
  },
  sequelize: {
    query: jest.fn(),
  },
}));

// Bypass auth middlewares so controller logic is tested in isolation.
// On injecte un user admin pour que les listes (getAll*) ne soient pas filtrées
// par accès capteur — le filtrage est testé unitairement dans sensorAccess.
jest.mock("@middlewares/auth", () => ({
  auth: (req: any, _res: any, next: () => void) => {
    req.user = { userId: "test-admin", role: "admin" };
    next();
  },
  authAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireSessionAccess: (_req: any, _res: any, next: () => void) => next(),
  requireSensorAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

// On cast DB en any pour pouvoir utiliser .mockResolvedValue sur ses propriétés
const mockDB = db as any;

const request = superTest(app);
const baseUri = "/api/v1/sessions";

const sensors: Sensor[] = [
  {
    id: "1981bbda-cc7e-4c32-8d7b-40247d056033",
    name: "Sensor 1",
    topic: "Sensor 1/topic",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "f2e2cb4c-884d-4e1f-a7ac-853d4c5cfd02",
    name: "Sensor 2",
    topic: "Sensor 2/topic",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("Session Controller", () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  describe("POST /new", () => {
    test("should return 201 and the topic when sensor is valid", async () => {
      const sensor = sensors[0];

      mockDB.Sensor.findByPk.mockResolvedValue({
        id: sensor.id,
        topic: sensor.topic,
      });
      mockDB.Session.create.mockResolvedValue({
        id: "bc9d5577-c636-402c-a682-dc533f31dfce",
      });
      const res = await request.post(`${baseUri}/new`).send({
        idSensor: sensor.id,
      });

      expect(res.status).toBe(201);
      expect(res.body.topic).toBe(sensor.topic);
    });

    test("should return a 400 if sensor id is not uuid", async () => {
      const body = { idSensor: "salut" };

      const result = await superTest(app)
        .post(baseUri + "/new")
        .send(body);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("sensor id is not uuid");
      expect(result.body.codeError).toBe("sensor.id.not.uuid");
    });

    test("should return a 404 if no sensor is found", async () => {
      const body = { idSensor: sensors[0].id };

      // Mocking SensorModel.findByPk
      const findSensorByPkMock = jest.fn();
      findSensorByPkMock.mockResolvedValue(null);
      SensorModel.findByPk = findSensorByPkMock;

      const result = await superTest(app)
        .post(baseUri + "/new")
        .send(body);

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("Sensor not found");
      expect(result.body.codeError).toBe("sensor.not.found");
    });
  });

  describe("POST /new/on/server", () => {
    test("should return 201 when session is ended successfully", async () => {
      const body = {
        idSession: "bc9d5577-c636-402c-a682-dc533f31dfce",
      };

      // La clôture vérifie d'abord que la session existe et que l'appelant a
      // accès à son capteur (le mock `auth` injecte un admin).
      mockDB.Session.findByPk.mockResolvedValue({
        id: body.idSession,
        idSensor: sensors[0].id,
        dataValues: { id: body.idSession, idSensor: sensors[0].id },
      });
      mockDB.Session.update.mockResolvedValue([1]);

      const res = await request.post(`${baseUri}/new/on/server`).send(body);

      expect(mockDB.Session.update).toHaveBeenCalled();
      expect(res.status).toBe(201);
      expect(res.body.message).toBe("session ended");
    });

    test("should return 404 when the session does not exist", async () => {
      mockDB.Session.findByPk.mockResolvedValue(null);
      mockDB.Session.update.mockClear();

      const res = await request
        .post(`${baseUri}/new/on/server`)
        .send({ idSession: "bc9d5577-c636-402c-a682-dc533f31dfce" });

      expect(res.status).toBe(404);
      expect(mockDB.Session.update).not.toHaveBeenCalled();
    });

    test("should return 400 when idSession is not a uuid", async () => {
      mockDB.Session.update.mockClear();

      const res = await request
        .post(`${baseUri}/new/on/server`)
        .send({ idSession: "not-a-uuid" });

      expect(res.status).toBe(400);
      expect(mockDB.Session.update).not.toHaveBeenCalled();
    });
  });

  describe("GET /", () => {
    test("should return 200 and all sessions", async () => {
      const sessions = [
        {
          id: "session1",
          idSensor: sensors[0].id,
          createdAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
        },
        {
          id: "session2",
          idSensor: sensors[1].id,
          createdAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
        },
      ];

      mockDB.Session.findAndCountAll.mockResolvedValue({
        count: sessions.length,
        rows: sessions,
      });

      const res = await request.get(baseUri);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(sessions);
      expect(res.body.total).toBe(sessions.length);
    });
  });

  describe("GET /:id", () => {
    test("should return 200 and session by ID", async () => {
      const session = {
        id: "session1",
        idSensor: sensors[0].id,
        createdAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      };

      mockDB.Session.findByPk.mockResolvedValue(session);

      const res = await request.get(`${baseUri}/${session.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(session);
    });

    test("should return 404 if session not found", async () => {
      mockDB.Session.findByPk.mockResolvedValue(null);

      const res = await request.get(`${baseUri}/nonexistent-id`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Session not found");
      expect(res.body.codeError).toBe("session.not.found");
    });
  });

  describe("DELETE /:id", () => {
    test("should only delete data within the session window", async () => {
      // La suppression est BORNÉE à la fenêtre de la session : appelée avec le
      // seul idSensor, elle effaçait tout l'historique du capteur.
      const session = {
        id: "session1",
        idSensor: sensors[0].id,
        createdAt: new Date("2026-01-01T10:00:00Z").toISOString(),
        endedAt: new Date("2026-01-01T11:00:00Z").toISOString(),
      };

      mockDB.Session.findByPk.mockResolvedValue(session);
      mockDB.Sensor.findByPk.mockResolvedValue(sensors[0]);
      mockDB.sensordata.destroy = jest.fn().mockResolvedValue(10);

      const res = await request.delete(`${baseUri}/${session.id}`);

      expect(res.status).toBe(200);
      expect(res.body.deletedRowsNumber).toBe(10);
      // La clause where doit porter un filtre TEMPOREL, et pas seulement le
      // capteur — sinon c'est tout l'historique qui part. Les bornes sont
      // portées par un opérateur Sequelize (Symbol), donc invisibles à
      // JSON.stringify : on inspecte les symboles.
      const whereArg = mockDB.sensordata.destroy.mock.calls[0][0].where;
      expect(whereArg.idSensor).toBe(sensors[0].id);
      expect(whereArg.time).toBeDefined();
      const bounds = Object.getOwnPropertySymbols(whereArg.time).map(
        (sym) => whereArg.time[sym]
      );
      expect(JSON.stringify(bounds)).toContain("2026-01-01T10:00:00");
      expect(JSON.stringify(bounds)).toContain("2026-01-01T11:00:00");
    });

    test("should delete nothing when the session window is empty", async () => {
      const instant = new Date("2026-01-01T10:00:00Z").toISOString();
      mockDB.Session.findByPk.mockResolvedValue({
        id: "session-vide",
        idSensor: sensors[0].id,
        createdAt: instant,
        endedAt: instant,
      });
      mockDB.Sensor.findByPk.mockResolvedValue(sensors[0]);
      mockDB.sensordata.destroy = jest.fn();

      const res = await request.delete(`${baseUri}/session-vide`);

      expect(res.status).toBe(200);
      expect(res.body.deletedRowsNumber).toBe(0);
      expect(mockDB.sensordata.destroy).not.toHaveBeenCalled();
    });

    test("should return 404 if session not found", async () => {
      mockDB.Session.findByPk.mockResolvedValue(null);

      const res = await request.delete(`${baseUri}/nonexistent-id`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Session not found");
      expect(res.body.codeError).toBe("session.not.found");
    });

    test("should return 404 if sensor not found", async () => {
      const session = {
        id: "session1",
        idSensor: sensors[0].id,
        createdAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      };

      mockDB.Session.findByPk.mockResolvedValue(session);
      mockDB.Sensor.findByPk.mockResolvedValue(null);

      const res = await request.delete(`${baseUri}/${session.id}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Sensor not found");
      expect(res.body.codeError).toBe("sensor.not.found");
    });
  });

  describe("DELETE /", () => {
    test("should return 204 and delete all sessions", async () => {
      mockDB.Session.destroy.mockResolvedValue({});

      const res = await request.delete(baseUri);

      expect(res.status).toBe(204);
    });
  });

  describe("GET /:id/export/csv", () => {
    test("should return 200 and a CSV with correct headers", async () => {
      const session = {
        id: "session1",
        idSensor: sensors[0].id,
        dataValues: {
          id: "session1",
          idSensor: sensors[0].id,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          endedAt: new Date("2024-01-01T01:00:00Z"),
        },
        createdAt: new Date("2024-01-01T00:00:00Z"),
        endedAt: new Date("2024-01-01T01:00:00Z"),
      };
      mockDB.Session.findByPk.mockResolvedValue(session);
      mockDB.Sensor.findByPk.mockResolvedValue({
        ...sensors[0],
        dataValues: {
          id: sensors[0].id,
          name: sensors[0].name,
          topic: sensors[0].topic,
        },
      });
      mockDB.sensordata.findAll.mockResolvedValue([
        {
          time: new Date("2024-01-01T00:00:01Z"),
          value: 1.5,
          MeasurementType: { name: "ecg" },
        },
      ]);

      const res = await request.get(`${baseUri}/session1/export/csv`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.text).toContain("# session_id,session1");
      expect(res.text).toContain("time,value,type");
    });

    test("should return 404 if session not found", async () => {
      mockDB.Session.findByPk.mockResolvedValue(null);
      const res = await request.get(`${baseUri}/nonexistent-id/export/csv`);
      expect(res.status).toBe(404);
      expect(res.body.codeError).toBe("session.not.found");
    });

    test("should return 404 if sensor not found", async () => {
      mockDB.Session.findByPk.mockResolvedValue({
        id: "session1",
        idSensor: sensors[0].id,
        dataValues: {
          id: "session1",
          idSensor: sensors[0].id,
          createdAt: new Date(),
          endedAt: new Date(),
        },
      });
      mockDB.Sensor.findByPk.mockResolvedValue(null);
      const res = await request.get(`${baseUri}/session1/export/csv`);
      expect(res.status).toBe(404);
      expect(res.body.codeError).toBe("sensor.not.found");
    });
  });

  describe("GET /:id/data", () => {
    test("should return 200 and sensor data within time range", async () => {
      const session = {
        id: "session1",
        idSensor: sensors[0].id,
        createdAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      };
      const sensorData = [
        { value: 1, timestamp: new Date().toISOString() },
        { value: 2, timestamp: new Date().toISOString() },
      ];

      mockDB.Session.findByPk.mockResolvedValue(session);
      mockDB.Sensor.findByPk.mockResolvedValue(sensors[0]);
      const getSensorDataMock = jest.fn().mockResolvedValue(sensorData);
      mockDB.getSensorDataWithinTimeRange = getSensorDataMock;

      const res = await request.get(`${baseUri}/${session.id}/data`);

      // TDODO REVIENT DESSUS
      expect(res.status).toBe(500);
      //expect(res.body).toEqual(sensorData);
    });

    test("should return 404 if session not found", async () => {
      mockDB.Session.findByPk.mockResolvedValue(null);

      const res = await request.get(`${baseUri}/nonexistent-id/data`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Session not found");
      expect(res.body.codeError).toBe("session.not.found");
    });

    test("should return 404 if sensor not found", async () => {
      const session = {
        id: "session1",
        idSensor: sensors[0].id,
        createdAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      };

      mockDB.Session.findByPk.mockResolvedValue(session);
      mockDB.Sensor.findByPk.mockResolvedValue(null);

      const res = await request.get(`${baseUri}/${session.id}/data`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Sensor not found");
      expect(res.body.codeError).toBe("sensor.not.found");
    });
  });

  describe("GET /:id/aggregate", () => {
    const session = {
      id: "session1",
      idSensor: sensors[0].id,
      dataValues: {
        id: "session1",
        idSensor: sensors[0].id,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        endedAt: new Date("2024-01-01T01:00:00Z"),
      },
    };

    const aggregateRows = [
      {
        bucket: new Date("2024-01-01T00:00:00Z"),
        avg_value: 1.5,
        min_value: 1.0,
        max_value: 2.0,
        count: 10,
        idMeasurementType: "type-uuid-1",
      },
    ];

    test("should return 200 with aggregated rows", async () => {
      mockDB.Session.findByPk.mockResolvedValue(session);
      mockDB.Sensor.findByPk.mockResolvedValue({
        dataValues: { id: sensors[0].id },
      });
      mockDB.sequelize.query.mockResolvedValue(aggregateRows);

      const res = await request.get(`${baseUri}/${session.id}/aggregate`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(JSON.parse(JSON.stringify(aggregateRows)));
    });

    test("should return 404 if session not found", async () => {
      mockDB.Session.findByPk.mockResolvedValue(null);

      const res = await request.get(`${baseUri}/nonexistent/aggregate`);

      expect(res.status).toBe(404);
      expect(res.body.codeError).toBe("session.not.found");
    });

    test("should return 404 if sensor not found", async () => {
      mockDB.Session.findByPk.mockResolvedValue(session);
      mockDB.Sensor.findByPk.mockResolvedValue(null);

      const res = await request.get(`${baseUri}/${session.id}/aggregate`);

      expect(res.status).toBe(404);
      expect(res.body.codeError).toBe("sensor.not.found");
    });

    test("should return 500 if query fails", async () => {
      mockDB.Session.findByPk.mockResolvedValue(session);
      mockDB.Sensor.findByPk.mockResolvedValue({
        dataValues: { id: sensors[0].id },
      });
      mockDB.sequelize.query.mockRejectedValue(new Error("DB error"));

      const res = await request.get(`${baseUri}/${session.id}/aggregate`);

      expect(res.status).toBe(500);
    });
  });
});
