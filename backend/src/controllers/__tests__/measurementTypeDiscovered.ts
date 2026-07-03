// Model(s) import
import db from "@db/index";
const DB: any = db;
const { MeasurementType: MeasurementTypeModel } = DB;
// --- End of model(s) import
import app from "@/app";
import superTest from "supertest";

// ── The factory cannot reference external variables (jest.mock is hoisted).
// We build the Map inside the factory and retrieve it with jest.requireMock.
jest.mock("@/service/discoverdMeasurementService", () => ({
  discoveredMeasurements: new Map([
    [
      "ecg",
      {
        measurementType: "ecg",
        firstSeenAt: "2024-01-01T10:00:00.000Z",
        lastSeenAt: "2024-01-01T10:05:00.000Z",
        count: 5,
      },
    ],
    [
      "temperature",
      {
        measurementType: "temperature",
        firstSeenAt: "2024-01-02T08:00:00.000Z",
        lastSeenAt: "2024-01-02T09:30:00.000Z",
        count: 2,
      },
    ],
  ]),
}));

// Retrieve the live Map instance that the controller will use
const mockDiscoveredMeasurements: Map<
  string,
  {
    measurementType: string;
    firstSeenAt: string;
    lastSeenAt: string;
    count: number;
  }
> = jest.requireMock(
  "@/service/discoverdMeasurementService"
).discoveredMeasurements;

jest.mock("@db/index", () => ({
  MeasurementType: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  Measurement: {
    hasOne: jest.fn(),
  },
}));

// Bypass auth middlewares so controller logic is tested in isolation
jest.mock("@middlewares/auth", () => ({
  auth: (_req: any, _res: any, next: () => void) => next(),
  authAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireSessionAccess: (_req: any, _res: any, next: () => void) => next(),
}));

const baseUri = "/api/v1/measurementTypes";

// ── GET /discovered ─────────────────────────────────────────────────────────

describe("GET /measurementTypes/discovered", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test("should return 200 with all discovered measurement types", async () => {
    const result = await superTest(app).get(`${baseUri}/discovered`);

    expect(result.status).toBe(200);
    expect(result.body).toHaveLength(2);
  });

  test("should include the correct shape for each entry", async () => {
    const result = await superTest(app).get(`${baseUri}/discovered`);

    expect(result.status).toBe(200);
    const ecgEntry = result.body.find(
      (e: { measurementType: string }) => e.measurementType === "ecg"
    );
    expect(ecgEntry).toBeDefined();
    expect(ecgEntry.measurementType).toBe("ecg");
    expect(ecgEntry.firstSeenAt).toBe("2024-01-01T10:00:00.000Z");
    expect(ecgEntry.lastSeenAt).toBe("2024-01-01T10:05:00.000Z");
    expect(ecgEntry.count).toBe(5);
  });

  test("should return an empty array when no measurement types have been discovered", async () => {
    mockDiscoveredMeasurements.clear();

    const result = await superTest(app).get(`${baseUri}/discovered`);

    expect(result.status).toBe(200);
    expect(result.body).toEqual([]);

    // Restore for subsequent tests
    mockDiscoveredMeasurements.set("ecg", {
      measurementType: "ecg",
      firstSeenAt: "2024-01-01T10:00:00.000Z",
      lastSeenAt: "2024-01-01T10:05:00.000Z",
      count: 5,
    });
    mockDiscoveredMeasurements.set("temperature", {
      measurementType: "temperature",
      firstSeenAt: "2024-01-02T08:00:00.000Z",
      lastSeenAt: "2024-01-02T09:30:00.000Z",
      count: 2,
    });
  });

  test("should return all entries as an array of values (not keys)", async () => {
    const result = await superTest(app).get(`${baseUri}/discovered`);

    expect(result.status).toBe(200);
    // Each item must have a measurementType field, not a baseTopic field
    result.body.forEach((entry: Record<string, unknown>) => {
      expect(entry).toHaveProperty("measurementType");
      expect(entry).toHaveProperty("firstSeenAt");
      expect(entry).toHaveProperty("lastSeenAt");
      expect(entry).toHaveProperty("count");
    });
  });
});

// ── POST / — delete from discoveredMeasurements on create ──────────────────

describe("POST /measurementTypes — discoveredMeasurements.delete side-effect", () => {
  beforeEach(() => {
    // Ensure the map contains the entry we will create
    if (!mockDiscoveredMeasurements.has("ecg")) {
      mockDiscoveredMeasurements.set("ecg", {
        measurementType: "ecg",
        firstSeenAt: "2024-01-01T10:00:00.000Z",
        lastSeenAt: "2024-01-01T10:05:00.000Z",
        count: 5,
      });
    }
  });

  afterEach(() => {
    jest.resetAllMocks();
    // Restore the map to a known state
    if (!mockDiscoveredMeasurements.has("ecg")) {
      mockDiscoveredMeasurements.set("ecg", {
        measurementType: "ecg",
        firstSeenAt: "2024-01-01T10:00:00.000Z",
        lastSeenAt: "2024-01-01T10:05:00.000Z",
        count: 5,
      });
    }
    if (!mockDiscoveredMeasurements.has("temperature")) {
      mockDiscoveredMeasurements.set("temperature", {
        measurementType: "temperature",
        firstSeenAt: "2024-01-02T08:00:00.000Z",
        lastSeenAt: "2024-01-02T09:30:00.000Z",
        count: 2,
      });
    }
  });

  test("should remove the name from discoveredMeasurements after a successful create", async () => {
    MeasurementTypeModel.findOne = jest.fn().mockResolvedValue(null);
    MeasurementTypeModel.create = jest
      .fn()
      .mockResolvedValue({ id: "uuid-1", name: "ecg" });

    expect(mockDiscoveredMeasurements.has("ecg")).toBe(true);

    const result = await superTest(app).post(baseUri).send({ name: "ecg" });

    expect(result.status).toBe(201);
    expect(mockDiscoveredMeasurements.has("ecg")).toBe(false);
  });

  test("should NOT remove from discoveredMeasurements when create returns null (500)", async () => {
    MeasurementTypeModel.findOne = jest.fn().mockResolvedValue(null);
    MeasurementTypeModel.create = jest.fn().mockResolvedValue(null);

    expect(mockDiscoveredMeasurements.has("ecg")).toBe(true);

    const result = await superTest(app).post(baseUri).send({ name: "ecg" });

    expect(result.status).toBe(500);
    // The delete is only called after a successful create, so the entry must still be there
    expect(mockDiscoveredMeasurements.has("ecg")).toBe(true);
  });

  test("should NOT remove from discoveredMeasurements when create throws (500)", async () => {
    MeasurementTypeModel.findOne = jest.fn().mockResolvedValue(null);
    MeasurementTypeModel.create = jest
      .fn()
      .mockRejectedValue(new Error("DB error"));

    expect(mockDiscoveredMeasurements.has("ecg")).toBe(true);

    const result = await superTest(app).post(baseUri).send({ name: "ecg" });

    expect(result.status).toBe(500);
    expect(mockDiscoveredMeasurements.has("ecg")).toBe(true);
  });

  test("should only remove the created name, leaving other entries intact", async () => {
    MeasurementTypeModel.findOne = jest.fn().mockResolvedValue(null);
    MeasurementTypeModel.create = jest
      .fn()
      .mockResolvedValue({ id: "uuid-1", name: "ecg" });

    const result = await superTest(app).post(baseUri).send({ name: "ecg" });

    expect(result.status).toBe(201);
    expect(mockDiscoveredMeasurements.has("ecg")).toBe(false);
    expect(mockDiscoveredMeasurements.has("temperature")).toBe(true);
  });

  test("should not fail when the name is not present in discoveredMeasurements (delete is a no-op)", async () => {
    MeasurementTypeModel.findOne = jest.fn().mockResolvedValue(null);
    MeasurementTypeModel.create = jest
      .fn()
      .mockResolvedValue({ id: "uuid-2", name: "pressure" });

    // "pressure" is not in the map
    expect(mockDiscoveredMeasurements.has("pressure")).toBe(false);

    const result = await superTest(app)
      .post(baseUri)
      .send({ name: "pressure" });

    expect(result.status).toBe(201);
    // Map size must be unchanged (delete on missing key is a no-op)
    expect(mockDiscoveredMeasurements.has("pressure")).toBe(false);
    expect(mockDiscoveredMeasurements.size).toBe(2);
  });
});
