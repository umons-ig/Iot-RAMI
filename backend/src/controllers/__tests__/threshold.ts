import superTest from "supertest";
import app from "@/app";
// Model(s) import
import db from "@db/index";
const DB: any = db;
const { Threshold: ThresholdModel } = DB;
// --- End of model(s) import
import jwt from "jsonwebtoken";
import { Role } from "#/user";

jest.mock("@db/index", () => ({
  // Due to the establishment of associations with RAMI1, the models are now imported from the db
  // Since the models all appear in the database from @db/index, we ONLY MAKE one mock from the db!
  Threshold: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Sensor: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Measurement: {
    hasOne: jest.fn(),
  },
  User: {
    hasOne: jest.fn(),
  },
  UserSensorAccess: {
    findAll: jest.fn(),
    hasOne: jest.fn(),
  },
}));

jest.mock("@service/discorverdSensorSevice", () => ({
  discoveredTopics: new Map(),
}));

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn().mockImplementation(() => ({
    userId: "user-uuid-1",
    role: "admin",
  })),
  decode: jest.fn().mockImplementation(() => ({
    userId: "user-uuid-1",
    role: "admin",
  })),
}));

const baseUri = "/api/v1/thresholds";

const sensorId = "1981bbda-cc7e-4c32-8d7b-40247d056033";
const measurementTypeId = "a4b43db2-ec5c-45a9-8b2e-1f4e2ccdf61f";
const thresholdId = "bc9d5577-c636-402c-a682-dc533f31dfce";

const thresholdFixture = {
  id: thresholdId,
  idSensor: sensorId,
  idMeasurementType: measurementTypeId,
  minValue: 10,
  maxValue: 100,
};

describe("Threshold controller", () => {
  afterEach(() => {
    jest.resetAllMocks();
    // Restore default jwt mocks after each test
    (jwt.verify as jest.Mock).mockImplementation(() => ({
      userId: "user-uuid-1",
      role: Role.ADMIN,
    }));
    (jwt.decode as jest.Mock).mockImplementation(() => ({
      userId: "user-uuid-1",
      role: Role.ADMIN,
    }));
  });

  describe("POST /thresholds", () => {
    test("should return 201 with the created threshold", async () => {
      ThresholdModel.create = jest.fn().mockResolvedValue(thresholdFixture);

      const body = {
        idSensor: sensorId,
        idMeasurementType: measurementTypeId,
        minValue: 10,
        maxValue: 100,
      };

      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(201);
      expect(result.body).toEqual(thresholdFixture);
      expect(ThresholdModel.create).toHaveBeenCalledWith({
        idSensor: sensorId,
        idMeasurementType: measurementTypeId,
        minValue: 10,
        maxValue: 100,
      });
    });

    test("should return 400 if idSensor is missing", async () => {
      const body = {
        idMeasurementType: measurementTypeId,
        minValue: 10,
        maxValue: 100,
      };

      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(400);
      expect(result.body.error).toBe(
        "idSensor and idMeasurementType are required"
      );
      expect(result.body.code).toBe("threshold.missing.fields");
    });

    test("should return 400 if idMeasurementType is missing", async () => {
      const body = {
        idSensor: sensorId,
        minValue: 10,
        maxValue: 100,
      };

      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(400);
      expect(result.body.error).toBe(
        "idSensor and idMeasurementType are required"
      );
      expect(result.body.code).toBe("threshold.missing.fields");
    });

    test("should return 400 if both idSensor and idMeasurementType are missing", async () => {
      const body = { minValue: 10, maxValue: 100 };

      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(400);
      expect(result.body.error).toBe(
        "idSensor and idMeasurementType are required"
      );
      expect(result.body.code).toBe("threshold.missing.fields");
    });

    test("should return 400 if idSensor is not a valid UUID (§2.6)", async () => {
      const result = await superTest(app)
        .post(baseUri)
        .send({
          idSensor: "not-a-uuid",
          idMeasurementType: measurementTypeId,
          minValue: 10,
          maxValue: 100,
        })
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(400);
      expect(result.body.code).toBe("threshold.invalid.id");
    });

    test("should return 400 if minValue >= maxValue (§2.6)", async () => {
      const result = await superTest(app)
        .post(baseUri)
        .send({
          idSensor: sensorId,
          idMeasurementType: measurementTypeId,
          minValue: 100,
          maxValue: 10,
        })
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(400);
      expect(result.body.code).toBe("threshold.invalid.range");
    });

    test("should return 400 if a value is not numeric (§2.6)", async () => {
      const result = await superTest(app)
        .post(baseUri)
        .send({
          idSensor: sensorId,
          idMeasurementType: measurementTypeId,
          minValue: "abc",
          maxValue: 100,
        })
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(400);
      expect(result.body.code).toBe("threshold.invalid.value");
    });

    test("should return 500 if Threshold.create throws an error", async () => {
      ThresholdModel.create = jest
        .fn()
        .mockRejectedValue(new Error("DB error"));

      const body = {
        idSensor: sensorId,
        idMeasurementType: measurementTypeId,
        minValue: 10,
        maxValue: 100,
      };

      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(500);
      expect(result.body.error).toBe("Internal server error.");
      expect(result.body.code).toBe("threshold.internal.error");
    });
  });

  describe("GET /thresholds/sensor/:idSensor", () => {
    test("should return 200 with the list of thresholds for the sensor", async () => {
      const thresholds = [
        thresholdFixture,
        { ...thresholdFixture, id: "another-uuid", minValue: 5, maxValue: 50 },
      ];
      ThresholdModel.findAll = jest.fn().mockResolvedValue(thresholds);

      const result = await superTest(app)
        .get(`${baseUri}/sensor/${sensorId}`)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(200);
      expect(result.body).toEqual(thresholds);
      expect(ThresholdModel.findAll).toHaveBeenCalledWith({
        where: { idSensor: sensorId },
      });
    });

    test("should return 404 if no thresholds are found for the sensor", async () => {
      ThresholdModel.findAll = jest.fn().mockResolvedValue([]);

      const result = await superTest(app)
        .get(`${baseUri}/sensor/${sensorId}`)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(404);
      expect(result.body.error).toBe(
        "No thresholds found for the given sensor."
      );
      expect(result.body.code).toBe("threshold.not.found");
    });

    test("should return 404 if findAll returns null", async () => {
      ThresholdModel.findAll = jest.fn().mockResolvedValue(null);

      const result = await superTest(app)
        .get(`${baseUri}/sensor/${sensorId}`)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(404);
      expect(result.body.error).toBe(
        "No thresholds found for the given sensor."
      );
      expect(result.body.code).toBe("threshold.not.found");
    });

    test("should return 500 if Threshold.findAll throws an error", async () => {
      ThresholdModel.findAll = jest
        .fn()
        .mockRejectedValue(new Error("DB error"));

      const result = await superTest(app)
        .get(`${baseUri}/sensor/${sensorId}`)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(500);
      expect(result.body.error).toBe("Internal server error.");
      expect(result.body.code).toBe("threshold.internal.error");
    });
  });

  describe("PUT /thresholds/:id", () => {
    test("should return 200 with the updated threshold", async () => {
      const updatedThreshold = {
        ...thresholdFixture,
        minValue: 20,
        maxValue: 200,
        save: jest.fn().mockResolvedValue(undefined),
      };
      ThresholdModel.findByPk = jest.fn().mockResolvedValue(updatedThreshold);

      const body = { minValue: 20, maxValue: 200 };

      const result = await superTest(app)
        .put(`${baseUri}/${thresholdId}`)
        .send(body)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(200);
      expect(updatedThreshold.save).toHaveBeenCalled();
      expect(result.body.minValue).toBe(20);
      expect(result.body.maxValue).toBe(200);
    });

    test("should keep existing values when minValue and maxValue are not provided", async () => {
      const thresholdInstance = {
        ...thresholdFixture,
        save: jest.fn().mockResolvedValue(undefined),
      };
      ThresholdModel.findByPk = jest.fn().mockResolvedValue(thresholdInstance);

      const result = await superTest(app)
        .put(`${baseUri}/${thresholdId}`)
        .send({})
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(200);
      expect(thresholdInstance.save).toHaveBeenCalled();
      // Values unchanged — controller keeps existing ones when undefined is passed
      expect(result.body.minValue).toBe(thresholdFixture.minValue);
      expect(result.body.maxValue).toBe(thresholdFixture.maxValue);
    });

    test("should return 404 if threshold is not found", async () => {
      ThresholdModel.findByPk = jest.fn().mockResolvedValue(null);

      const body = { minValue: 20, maxValue: 200 };

      const result = await superTest(app)
        .put(`${baseUri}/${thresholdId}`)
        .send(body)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(404);
      expect(result.body.error).toBe("Threshold not found.");
      expect(result.body.code).toBe("threshold.not.found");
    });

    test("should return 500 if Threshold.findByPk throws an error", async () => {
      ThresholdModel.findByPk = jest
        .fn()
        .mockRejectedValue(new Error("DB error"));

      const body = { minValue: 20, maxValue: 200 };

      const result = await superTest(app)
        .put(`${baseUri}/${thresholdId}`)
        .send(body)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(500);
      expect(result.body.error).toBe("Internal server error.");
      expect(result.body.code).toBe("threshold.internal.error");
    });

    test("should return 500 if threshold.save throws an error", async () => {
      const thresholdInstance = {
        ...thresholdFixture,
        save: jest.fn().mockRejectedValue(new Error("Save failed")),
      };
      ThresholdModel.findByPk = jest.fn().mockResolvedValue(thresholdInstance);

      const body = { minValue: 20, maxValue: 200 };

      const result = await superTest(app)
        .put(`${baseUri}/${thresholdId}`)
        .send(body)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(500);
      expect(result.body.error).toBe("Internal server error.");
      expect(result.body.code).toBe("threshold.internal.error");
    });
  });

  describe("DELETE /thresholds/:id", () => {
    test("should return 200 with a success message when threshold is deleted", async () => {
      const thresholdInstance = {
        ...thresholdFixture,
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      ThresholdModel.findByPk = jest.fn().mockResolvedValue(thresholdInstance);

      const result = await superTest(app)
        .delete(`${baseUri}/${thresholdId}`)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(200);
      expect(result.body.message).toBe("Threshold deleted successfully.");
      expect(thresholdInstance.destroy).toHaveBeenCalled();
    });

    test("should return 404 if threshold is not found", async () => {
      ThresholdModel.findByPk = jest.fn().mockResolvedValue(null);

      const result = await superTest(app)
        .delete(`${baseUri}/${thresholdId}`)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(404);
      expect(result.body.error).toBe("Threshold not found.");
      expect(result.body.code).toBe("threshold.not.found");
    });

    test("should return 500 if Threshold.findByPk throws an error", async () => {
      ThresholdModel.findByPk = jest
        .fn()
        .mockRejectedValue(new Error("DB error"));

      const result = await superTest(app)
        .delete(`${baseUri}/${thresholdId}`)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(500);
      expect(result.body.error).toBe("Internal server error.");
      expect(result.body.code).toBe("threshold.internal.error");
    });

    test("should return 500 if threshold.destroy throws an error", async () => {
      const thresholdInstance = {
        ...thresholdFixture,
        destroy: jest.fn().mockRejectedValue(new Error("Destroy failed")),
      };
      ThresholdModel.findByPk = jest.fn().mockResolvedValue(thresholdInstance);

      const result = await superTest(app)
        .delete(`${baseUri}/${thresholdId}`)
        .set("Authorization", "Bearer test-token");

      expect(result.status).toBe(500);
      expect(result.body.error).toBe("Internal server error.");
      expect(result.body.code).toBe("threshold.internal.error");
    });
  });
});
