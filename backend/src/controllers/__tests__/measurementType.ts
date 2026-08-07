import { MeasurementType } from "#/measurementType";
// Model(s) import
import db from "@db/index";
const DB: any = db;
const { MeasurementType: MeasurementTypeModel } = DB;
// --- End of model(s) import
import {
  checkId,
  checkIfNameExists,
  checkName,
} from "@controllers/measurementType";
import { BadRequestException, ServerErrorException } from "@utils/exceptions";
import superTest from "supertest";
import app from "@/app";

jest.mock("@db/index", () => ({
  // Due to the establishment of associations with RAMI1, the models are now imported from the db
  // Since the models all appear in the database from @db/index, we ONLY MAKE one mock from the db!
  MeasurementType: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
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
  requireSensorAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

const baseUri = "/api/v1/measurementTypes";

const measurementTypes: MeasurementType[] = [
  {
    id: "1981bbda-cc7e-4c32-8d7b-40247d056033",
    name: "MeasurementType 1",
  },
  {
    id: "f2e2cb4c-884d-4e1f-a7ac-853d4c5cfd02",
    name: "MeasurementType 2",
  },
];

describe("Auxiliary functions", () => {
  describe("checkName", () => {
    test("should throw BadRequestException when name is not provided", () => {
      expect(() => checkName("")).toThrowError(BadRequestException);
      expect(() => checkName("")).toThrowError("Name is required");
    });

    test("should throw BadRequestException when name is too long", () => {
      const longName = "a".repeat(256);
      expect(() => checkName(longName)).toThrowError(BadRequestException);
      expect(() => checkName(longName)).toThrowError("Name is too long");
    });

    test("should throw BadRequestException when name is too short", () => {
      expect(() => checkName("ab")).toThrowError(BadRequestException);
      expect(() => checkName("ab")).toThrowError("Name is too short");
    });

    test("should not throw any error when name is valid", () => {
      expect(() => checkName("Valid Name")).not.toThrow();
    });
  });

  describe("checkId", () => {
    test("should throw BadRequestException when id is not provided", () => {
      expect(() => checkId("")).toThrowError(BadRequestException);
      expect(() => checkId("")).toThrowError("Id is required");
    });

    test("should throw BadRequestException when id length is not 36", () => {
      expect(() => checkId("12345")).toThrowError(BadRequestException);
      expect(() => checkId("12345")).toThrowError("Id must be a valid uuid");
    });

    test("should not throw any error when id is valid", () => {
      expect(() =>
        checkId("a4b43db2-ec5c-45a9-8b2e-1f4e2ccdf61f")
      ).not.toThrow();
    });
  });

  describe("checkIfNameExists", () => {
    test("should throw BadRequestException when name already exists", async () => {
      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue(measurementTypes[0]);
      MeasurementTypeModel.findOne = findOneMock;

      await expect(checkIfNameExists("MeasurementType 1")).rejects.toEqual(
        new BadRequestException(
          "MeasurementType already exists",
          "measurementType.already.exists"
        )
      );
    });

    test("should not throw any error when name does not exist", async () => {
      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue(null);
      MeasurementTypeModel.findOne = findOneMock;

      await expect(
        checkIfNameExists("MeasurementType 1")
      ).resolves.not.toThrow();
    });
    test("should throws a server error when findOne throw an error", async () => {
      const findOneMock = jest.fn();
      findOneMock.mockRejectedValue(new Error("Error"));
      MeasurementTypeModel.findOne = findOneMock;

      await expect(checkIfNameExists("MeasurementType 1")).rejects.toEqual(
        new ServerErrorException("Server error", "server.error")
      );
    });
  });
});

describe("MeasurementType controller", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("GET /", () => {
    test("should return a 200 with all measurementTypes if no id is provided", async () => {
      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurementTypes);
      MeasurementTypeModel.findAll = findAllMock;

      const result = await superTest(app).get(baseUri);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(measurementTypes);
    });

    test("should return a 200 with the measurementType associated with the id", async () => {
      const findByPkMock = jest.fn();
      findByPkMock.mockResolvedValue(measurementTypes[0]);
      MeasurementTypeModel.findByPk = findByPkMock;

      const result = await superTest(app).get(
        baseUri + "/1981bbda-cc7e-4c32-8d7b-40247d056033"
      );

      expect(result.status).toBe(200);
      expect(result.body).toEqual(measurementTypes[0]);
    });

    test("should return a 404 if no measurementType is found", async () => {
      const findByPkMock = jest.fn();
      findByPkMock.mockResolvedValue(null);
      MeasurementTypeModel.findByPk = findByPkMock;

      const result = await superTest(app).get(
        baseUri + "/1981bbda-cc7e-4c32-8d7b-40247d056033"
      );

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("MeasurementType not found");
      expect(result.body.codeError).toBe("measurementType.not.found");
    });

    test("should return a 500 if findByPk or findAll throw an error", async () => {
      const findAllMock = jest.fn();
      findAllMock.mockRejectedValue(new Error("Error"));
      MeasurementTypeModel.findAll = findAllMock;

      const result = await superTest(app).get(baseUri);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });
  });

  describe("POST /", () => {
    test("should return a 201 with the created measurementType", async () => {
      const createMock = jest.fn();
      createMock.mockResolvedValue(measurementTypes[0]);
      MeasurementTypeModel.create = createMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue(null);
      MeasurementTypeModel.findOne = findOneMock;

      const body = { name: measurementTypes[0].name };

      const result = await superTest(app).post(baseUri).send(body);

      expect(result.status).toBe(201);
      expect(result.body).toEqual(measurementTypes[0]);
    });

    test("should return a 400 if name is not provided", async () => {
      const body = { name: "" };

      const result = await superTest(app).post(baseUri).send(body);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Name is required");
      expect(result.body.codeError).toBe("measurementType.name.required");
    });

    test("should return a 400 if name already exists", async () => {
      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue(measurementTypes[0]);
      MeasurementTypeModel.findOne = findOneMock;

      const body = { name: measurementTypes[0].name };

      const result = await superTest(app).post(baseUri).send(body);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("MeasurementType already exists");
      expect(result.body.codeError).toBe("measurementType.already.exists");
    });
    test("should return a 500 if name already exists throw an error", async () => {
      const findOneMock = jest.fn();
      findOneMock.mockRejectedValue(new Error("Error"));
      MeasurementTypeModel.findOne = findOneMock;

      const body = { name: measurementTypes[0].name };

      const result = await superTest(app).post(baseUri).send(body);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });
    test("should return a 500 if create return nothing", async () => {
      const createMock = jest.fn();
      createMock.mockResolvedValue(null);
      MeasurementTypeModel.create = createMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue(null);
      MeasurementTypeModel.findOne = findOneMock;

      const body = { name: measurementTypes[0].name };

      const result = await superTest(app).post(baseUri).send(body);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });
    test("should return a 500 if create or findOne throw an error", async () => {
      const createMock = jest.fn();
      createMock.mockRejectedValue(new Error("Error"));
      MeasurementTypeModel.create = createMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue(null);
      MeasurementTypeModel.findOne = findOneMock;

      const body = { name: measurementTypes[0].name };

      const result = await superTest(app).post(baseUri).send(body);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });
  });

  describe("PUT /:id", () => {
    test("should return a 200 with the updated measurementType", async () => {
      const responseExpected = measurementTypes[0];
      responseExpected.name = "Updated Measurement Type";

      const updateMock = jest.fn();
      updateMock.mockResolvedValue(responseExpected);
      MeasurementTypeModel.update = updateMock;
      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue(measurementTypes[0]);
      MeasurementTypeModel.findOne = findOneMock;

      const body = { name: "Updated Measurement Type" };

      const result = await superTest(app)
        .put(baseUri + "/1981bbda-cc7e-4c32-8d7b-40247d056033")
        .send(body);

      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        ...responseExpected,
      });
    });

    test("should return a 400 if name is not provided", async () => {
      const body = { name: "" };

      const result = await superTest(app)
        .put(baseUri + "/1981bbda-cc7e-4c32-8d7b-40247d056033")
        .send(body);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Name is required");
      expect(result.body.codeError).toBe("measurementType.name.required");
    });

    test("should return a 404 if no measurementType is found", async () => {
      const updateMock = jest.fn();
      updateMock.mockResolvedValue(null);
      MeasurementTypeModel.update = updateMock;

      const body = { name: "Updated Measurement Type" };

      const result = await superTest(app)
        .put(baseUri + "/1981bbda-cc7e-4c32-8d7b-40247d056033")
        .send(body);

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("MeasurementType not found");
      expect(result.body.codeError).toBe("measurementType.not.found");
    });

    test("should return a 500 if update or findByPk throw an error", async () => {
      const updateMock = jest.fn();
      updateMock.mockRejectedValue(new Error("Error"));
      MeasurementTypeModel.update = updateMock;

      const findByPkMock = jest.fn();
      findByPkMock.mockResolvedValue(measurementTypes[0]);
      MeasurementTypeModel.findByPk = findByPkMock;

      const body = { name: "Updated Measurement Type" };

      const result = await superTest(app)
        .put(baseUri + "/1981bbda-cc7e-4c32-8d7b-40247d056033")
        .send(body);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });
  });

  describe("DELETE /:id", () => {
    test("should return a 200 if measurementType is successfully deleted", async () => {
      const destroyMock = jest.fn();
      destroyMock.mockResolvedValue(1);
      MeasurementTypeModel.destroy = destroyMock;
      const result = await superTest(app).delete(
        baseUri + "/1981bbda-cc7e-4c32-8d7b-40247d056033"
      );

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ message: "MeasurementType deleted" });
    });
    test("should return a 400 if id is not a UUIDv4", async () => {
      const result = await superTest(app).delete(baseUri + "/123");

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Id must be a valid uuid");
      expect(result.body.codeError).toBe("measurementType.id.not.uuid");
    });
    test("should return a 404 if no measurementType is found", async () => {
      const destroyMock = jest.fn();
      destroyMock.mockResolvedValue(0);
      MeasurementTypeModel.destroy = destroyMock;

      const result = await superTest(app).delete(
        baseUri + "/1981bbda-cc7e-4c32-8d7b-40247d056033"
      );

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("MeasurementType not found");
      expect(result.body.codeError).toBe("measurementType.not.found");
    });

    test("should return a 500 if destroy throws an error", async () => {
      const destroyMock = jest.fn();
      destroyMock.mockRejectedValue(new Error("Error"));
      MeasurementTypeModel.destroy = destroyMock;

      const result = await superTest(app).delete(
        baseUri + "/1981bbda-cc7e-4c32-8d7b-40247d056033"
      );

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });
  });
});
