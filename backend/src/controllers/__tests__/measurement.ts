import app from "@/app";
// Model(s) import
import db from "@db/index";
const DB: any = db;
const { Measurement, MeasurementType, Sensor, UserSensorAccess } = DB;
// --- End of model(s) import
import {
  Measurement as MeasurementModel,
  MeasurementModel as MeasurementModelModel,
} from "#/measurement";

import superTest from "supertest";
import { formatKey, getSample } from "@controllers/measurement";
import { ServerErrorException } from "@utils/exceptions";
import { Role } from "#/user";
import jwt from "jsonwebtoken";

jest.mock("@db/index", () => ({
  // Due to the establishment of associations with RAMI1, the models are now imported from the db
  // Since the models all appear in the database from @db/index, we ONLY MAKE one mock from the db!
  Measurement: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    bulkCreate: jest.fn(),
  },
  MeasurementType: {
    findOne: jest.fn(),
  },
  Sensor: {
    findOne: jest.fn(),
  },
  User: {
    hasOne: jest.fn(),
  },
  UserSensorAccess: {
    findAll: jest.fn(),
  },
}));

jest.mock("jsonwebtoken", () => {
  return {
    verify: jest.fn().mockImplementation(() => {
      return {
        id: "id-1",
        role: "regular",
      };
    }),
    decode: jest.fn().mockImplementation(() => {
      return {
        id: "id-1",
        role: "regular",
      };
    }),
  };
});

const baseUri = "/api/v1/measurements";

const measurements: MeasurementModel[] = [
  {
    id: "d15bc110-45c6-4c58-a07e-0b95a1de46a4",
    timestamp: new Date("2023-06-01T07:47:36.211Z"),
    value: 100,
    idMeasurementType: "f2e2cb4c-884d-4e1f-a7ac-853d4c5cfd02",
    idSensor: "41dc4ac0-a279-48c1-805a-557700e2ebb9",
  },
  {
    id: "67eea3c9-b228-455c-8419-8b59a3f4e8a8",
    timestamp: new Date("2022-06-01T07:47:36.211Z"),
    value: 150,
    idMeasurementType: "42ff436e-2359-4836-afae-7163ea7f3a7e",
    idSensor: "cd9d2154-bc2c-4c95-b1f1-8879574e85f8",
  },
];

const firstMeasurementJson2 = {
  dataValues: {
    id: "d15bc110-45c6-4c58-a07e-0b95a1de46a4",
    timestamp: "2023-06-01T07:47:36.211Z",
    value: 100,
    idMeasurementType: "f2e2cb4c-884d-4e1f-a7ac-853d4c5cfd02",
    idSensor: "41dc4ac0-a279-48c1-805a-557700e2ebb9",
  },
};

const measurementsDataValues = [
  {
    dataValues: {
      id: "d15bc110-45c6-4c58-a07e-0b95a1de46a4",
      timestamp: new Date("2023-06-01T07:47:36.211Z"),
      value: 100,
      idMeasurementType: "f2e2cb4c-884d-4e1f-a7ac-853d4c5cfd02",
      idSensor: "41dc4ac0-a279-48c1-805a-557700e2ebb9",
    },
  },
  {
    dataValues: {
      id: "67eea3c9-b228-455c-8419-8b59a3f4e8a8",
      timestamp: new Date("2022-06-01T07:47:36.211Z"),
      value: 150,
      idMeasurementType: "42ff436e-2359-4836-afae-7163ea7f3a7e",
      idSensor: "cd9d2154-bc2c-4c95-b1f1-8879574e85f8",
    },
  },
];

const measurementsDataValuesJson = [
  {
    dataValues: {
      id: "d15bc110-45c6-4c58-a07e-0b95a1de46a4",
      timestamp: "2023-06-01T07:47:36.211Z",
      value: 100,
      idMeasurementType: "f2e2cb4c-884d-4e1f-a7ac-853d4c5cfd02",
      idSensor: "41dc4ac0-a279-48c1-805a-557700e2ebb9",
    },
  },
  {
    dataValues: {
      id: "67eea3c9-b228-455c-8419-8b59a3f4e8a8",
      timestamp: "2022-06-01T07:47:36.211Z",
      value: 150,
      idMeasurementType: "42ff436e-2359-4836-afae-7163ea7f3a7e",
      idSensor: "cd9d2154-bc2c-4c95-b1f1-8879574e85f8",
    },
  },
];

const firstMeasurementJson = {
  id: "d15bc110-45c6-4c58-a07e-0b95a1de46a4",
  timestamp: "2023-06-01T07:47:36.211Z",
  value: 100,
  idMeasurementType: "f2e2cb4c-884d-4e1f-a7ac-853d4c5cfd02",
  idSensor: "41dc4ac0-a279-48c1-805a-557700e2ebb9",
};

const measurementsJson = [
  {
    id: "d15bc110-45c6-4c58-a07e-0b95a1de46a4",
    timestamp: "2023-06-01T07:47:36.211Z",
    value: 100,
    idMeasurementType: "f2e2cb4c-884d-4e1f-a7ac-853d4c5cfd02",
    idSensor: "41dc4ac0-a279-48c1-805a-557700e2ebb9",
  },
  {
    id: "67eea3c9-b228-455c-8419-8b59a3f4e8a8",
    timestamp: "2022-06-01T07:47:36.211Z",
    value: 150,
    idMeasurementType: "42ff436e-2359-4836-afae-7163ea7f3a7e",
    idSensor: "cd9d2154-bc2c-4c95-b1f1-8879574e85f8",
  },
];

describe("Measurement controller", () => {
  beforeEach(() => {
    // The auth middleware now decodes the JWT via jwt.verify. Because afterEach
    // resets all mocks (wiping the default implementation), restore a valid
    // payload here so requests carrying a Bearer token pass the middleware.
    const defaultPayload = { userId: "id-1", role: "regular", tokenVersion: 0 };
    (jwt.verify as jest.Mock).mockReturnValue(defaultPayload);
    (jwt.decode as jest.Mock).mockReturnValue(defaultPayload);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("POST/", () => {
    describe("One measurement", () => {
      test("should return a 400 if no date is provided", async () => {
        const body = { date: "" };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(400);
        expect(result.body.message).toBe("Date is required");
        expect(result.body.codeError).toBe("measurement.date.required");
      });

      test("should return a 400 if date isn't correct", async () => {
        const body = { date: "22-01-01" };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(400);
        expect(result.body.message).toBe("Date is not valid");
        expect(result.body.codeError).toBe("measurement.date.not.valid");
      });
      /*test("should return a 400 if invalid token is provided", async () => {
      const body = { date: "" };
      const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Invalid token !");
      expect(result.body.codeError).toBe("auth.token.invalid");
    });

    test("should return a 400 if no date is provided", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const body = { date: "" };
      const result = await superTest(app)
        .post(baseUri)
        .set("Authorization", `Bearer 1234`)
        .send(body);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Date is required");
      expect(result.body.codeError).toBe("measurement.date.required");
    });

    test("should return a 400 if date isn't correct", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const body = { date: "22-01-01" };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);


      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Date is not valid");
      expect(result.body.codeError).toBe("measurement.date.not.valid");
    });

    test("should return a 400 if no value is provided", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const body = { date: "220101", value: "" };
      const result = await superTest(app).post(baseUri).send(body).set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Value is required");
      expect(result.body.codeError).toBe("measurement.value.required");
    });

    test("should return a 400 if value isn't correct", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const body = { date: "220101", value: "a" };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Value is invalid");
      expect(result.body.codeError).toBe("measurement.value.not.valid");
    });

    test("should return a 400 if no type is provided", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const body = { date: "220101", value: "1", type: "" };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Type is required");
      expect(result.body.codeError).toBe(
        "measurement.measurementType.required"
      );
    });

    test("should return a 404 if type is not found", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const body = {
        date: "220101",
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139"
      };
      const findOneMockType = jest.fn();
      findOneMockType.mockResolvedValueOnce(null);
      MeasurementType.findOne = findOneMockType;

      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("Measurement type not found");
      expect(result.body.codeError).toBe(
        "measurement.measurementType.not.found"
      );
    });

    test("should return a 400 if no sensor is provided", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMockType = jest.fn();
      findOneMockType.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" }
      });
      MeasurementType.findOne = findOneMockType;

      const body = {
        date: "220101",
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        sensor: ""
      };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Sensor is required");
      expect(result.body.codeError).toBe("measurement.sensor.required");
    });

    test("should return a 500 if create return is null", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMockReturn = jest.fn();
      findOneMockReturn.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" }
      });
      MeasurementType.findOne = findOneMockReturn;
      Sensor.findOne = findOneMockReturn;*/

      test("should return a 400 if no value is provided", async () => {
        const body = { date: "220101", value: "" };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(400);
        expect(result.body.message).toBe("Value is required");
        expect(result.body.codeError).toBe("measurement.value.required");
        /*
      const body = {
        date: "220101",
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139"
      };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");*/
      });

      /*test("should return a 500 if create return an error", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" }
      });*/

      test("should return a 400 if value isn't correct", async () => {
        const body = { date: "220101", value: "a" };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(400);
        expect(result.body.message).toBe("Value is invalid");
        expect(result.body.codeError).toBe("measurement.value.not.valid");
        /*
      const body = {
        date: "220101",
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139"
      };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");*/
      });

      /*test("should return a 500 if findOne of MeasurementType return an error", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockRejectedValue(new Error());
      MeasurementType.findOne = findOneMock;

      const body = {
        date: "220101",
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139"
      };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });

    test("should return a 500 if findOne of Sensor return an error", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" }
      });*/

      test("should return a 400 if no type is provided", async () => {
        const body = { date: "220101", value: "1", type: "" };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(400);
        expect(result.body.message).toBe("Type is required");
        expect(result.body.codeError).toBe(
          "measurement.measurementType.required"
        ); /*
      const body = {
        date: "220101",
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        sensor: "esp32-1"
      };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");*/
      });

      /*test("should return a 400 if decode return null", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      const decodeMock = jest.fn();
      decodeMock.mockReturnValue(null);
      jwt.decode = decodeMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" }
      });*/
      test("should return a 404 if type is not found", async () => {
        const body = {
          date: "220101",
          value: "1",
          type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        };
        const findOneMock = jest.fn();
        findOneMock.mockResolvedValueOnce(null);
        MeasurementType.findOne = findOneMock;

        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(404);
        expect(result.body.message).toBe("Measurement type not found");
        expect(result.body.codeError).toBe(
          "measurement.measurementType.not.found"
        );
      }); /*
      const body = {
        date: "220101",
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139"
      };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Invalid token !");
      expect(result.body.codeError).toBe("auth.token.invalid");
    });*/

      test("should return a 500 if the middleware token verification throws", async () => {
        const verifyMock = jest.fn();
        verifyMock.mockImplementation(() => {
          throw new Error();
        });
        jwt.verify = verifyMock;

        const findOneMock = jest.fn();
        findOneMock.mockResolvedValue({
          dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
        });
        MeasurementType.findOne = findOneMock;
        Sensor.findOne = findOneMock;

        const createMock = jest.fn();
        createMock.mockResolvedValue(measurements[0]);
        Measurement.create = createMock;

        const body = {
          date: "220101",
          value: "1",
          type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
          sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(500);
        expect(result.body.message).toBe("Server error !");
        expect(result.body.codeError).toBe("server.error");
      });

      test("should return a 201 if everything is good", async () => {
        const verifyMock = jest.fn();
        verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
        jwt.verify = verifyMock;
        jwt.decode = verifyMock;

        const findOneMock = jest.fn();
        findOneMock.mockResolvedValue({
          dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
        });
        MeasurementType.findOne = findOneMock;
        Sensor.findOne = findOneMock;

        const createMock = jest.fn();
        createMock.mockResolvedValue(measurements[0]);
        Measurement.create = createMock;

        const body = {
          date: "220101",
          value: "1",
          type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
          sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(201);
        expect(result.body).toStrictEqual(firstMeasurementJson);
      });

      test("should return a 400 if no sensor is provided", async () => {
        const findOneMock = jest.fn();
        findOneMock.mockResolvedValue({
          dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
        });
        MeasurementType.findOne = findOneMock;

        const body = {
          date: "220101",
          value: "1",
          type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
          sensor: "",
        };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(400);
        expect(result.body.message).toBe("Sensor is required");
        expect(result.body.codeError).toBe("measurement.sensor.required");
      });
      /*
      test("should return a 500 if create return is null", async () => {
        const findOneMock = jest.fn();
        findOneMock.mockResolvedValue({
          dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
        });
        MeasurementType.findOne = findOneMock;
        Sensor.findOne = findOneMock;

        const createMock = jest.fn();
        createMock.mockResolvedValue(null);
        Measurement.create = createMock;

        const body = {
          date: "220101",
          value: "1",
          type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
          sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(500);
        expect(result.body.message).toBe("Server error");
        expect(result.body.codeError).toBe("server.error");
      });*/
      /*
      test("should return a 500 if create return an error", async () => {
        const findOneMock = jest.fn();
        findOneMock.mockResolvedValue({
          dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
        });
        MeasurementType.findOne = findOneMock;
        Sensor.findOne = findOneMock;

        const createMock = jest.fn();
        createMock.mockRejectedValue(new Error());
        Measurement.create = createMock;

        const body = {
          date: "220101",
          value: "1",
          type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
          sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(500);
        expect(result.body.message).toBe("Server error");
        expect(result.body.codeError).toBe("server.error");
      });*/
      test("should return a 500 if findOne of MeasurementType return an error", async () => {
        const findOneMock = jest.fn();
        findOneMock.mockRejectedValue(new Error());
        MeasurementType.findOne = findOneMock;

        const body = {
          date: "220101",
          value: "1",
          type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
          sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(500);
        expect(result.body.message).toBe("Server error");
        expect(result.body.codeError).toBe("server.error");
      });
      test("should return a 500 if findOne of Sensor return an error", async () => {
        const findOneMock = jest.fn();
        findOneMock.mockResolvedValue({
          dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
        });
        MeasurementType.findOne = findOneMock;

        const findOneSensorMock = jest.fn();
        findOneSensorMock.mockRejectedValue(new Error());
        Sensor.findOne = findOneSensorMock;

        const body = {
          date: "220101",
          value: "1",
          type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
          sensor: "esp32-1",
        };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(500);
        expect(result.body.message).toBe("Server error");
        expect(result.body.codeError).toBe("server.error");
      });
      /*
      test("should return a 201 if everything is good", async () => {
        const findOneMock = jest.fn();
        findOneMock.mockResolvedValue({
          dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
        });
        MeasurementType.findOne = findOneMock;
        Sensor.findOne = findOneMock;

        const createMock = jest.fn();
        createMock.mockResolvedValue(measurements[0]);
        Measurement.create = createMock;

        const body = {
          date: "220101",
          value: "1",
          type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
          sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        };
        const result = await superTest(app)
          .post(baseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(201);
        expect(result.body).toStrictEqual(firstMeasurementJson);
      });*/
    });

    describe("Several measurements", () => {
      const localBaseUri = "/api/v1/measurements/bulk";
      const measurementsBulk = measurements.map((measurement) => {
        return {
          id: measurement.id,
          date: measurement.timestamp,
          value: measurement.value,
          type: measurement.idMeasurementType,
          sensor: measurement.idSensor,
        };
      });
      test("should return a 400 if no measurements are provided", async () => {
        const body = [] as string[];
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(400);
        expect(result.body.message).toBe("Measurements are required");
        expect(result.body.codeError).toBe("measurement.measurements.required");
      });
      test("should return a 400 if measurements are not an array", async () => {
        const body = "test";
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(400);
        expect(result.body.message).toBe("Measurements must be an array");
        expect(result.body.codeError).toBe(
          "measurement.measurements.not.array"
        );
      });
      test("should return a 400 if measurements size is superior to 1000", async () => {
        const body = new Array(1001);
        for (let i = 0; i < 1001; i++) {
          body[i] = measurements[0];
        }
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(400);
        expect(result.body.message).toBe(
          "Maximum number of measurements is 1000"
        );
        expect(result.body.codeError).toBe("measurement.measurements.max");
      });
      test("should return a 201 if the measurement are created and send", async () => {
        const bulkCreate = jest.fn();
        bulkCreate.mockResolvedValue(measurements);
        Measurement.bulkCreate = bulkCreate;

        const findAll = jest.fn();

        findAll.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].type,
            },
          },
          {
            dataValues: {
              id: measurementsBulk[1].id,
              name: measurementsBulk[1].type,
            },
          },
        ]);
        MeasurementType.findAll = findAll;

        const findAllSensor = jest.fn();
        findAllSensor.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].sensor,
            },
          },
          {
            dataValues: {
              id: measurementsBulk[1].id,
              name: measurementsBulk[1].sensor,
            },
          },
        ]);
        Sensor.findAll = findAllSensor;

        const body = measurementsBulk;
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(201);
        expect(result.body).toStrictEqual(measurementsJson);
      });
      test("should return a 201 if the measurement are created and send (same sensor and type)", async () => {
        const bulkCreate = jest.fn();
        bulkCreate.mockResolvedValue(measurements);
        Measurement.bulkCreate = bulkCreate;

        const findAll = jest.fn();
        findAll.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].type,
            },
          },
        ]);
        MeasurementType.findAll = findAll;

        const findAllSensor = jest.fn();
        findAllSensor.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].sensor,
            },
          },
        ]);
        Sensor.findAll = findAllSensor;

        const body = [measurementsBulk[0], measurementsBulk[0]];
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(201);
        expect(result.body).toStrictEqual(measurementsJson);
      });
      test("should return a 207 if some measurements are created and some not (problem with sensor)", async () => {
        const bulkCreate = jest.fn();
        bulkCreate.mockResolvedValue([measurements[0]]);
        Measurement.bulkCreate = bulkCreate;

        const findAll = jest.fn();
        findAll.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].type,
            },
          },
          {
            dataValues: {
              id: measurementsBulk[1].id,
              name: measurementsBulk[1].type,
            },
          },
        ]);
        MeasurementType.findAll = findAll;

        const findAllSensor = jest.fn();
        findAllSensor.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].sensor,
            },
          },
        ]);
        Sensor.findAll = findAllSensor;

        const body = measurementsBulk;
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(207);
        expect(result.body.message).toStrictEqual(
          "Sensors not found: " +
            measurementsBulk[1].sensor +
            " on measurements: 1; Some measurements were created, but not all of them. Created: 1 of 2; "
        );
      });
      test("should return a 207 if some measurements are created and some not (problem with type)", async () => {
        const bulkCreate = jest.fn();
        bulkCreate.mockResolvedValue([measurements[0]]);
        Measurement.bulkCreate = bulkCreate;

        const findAllType = jest.fn();
        findAllType.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].type,
            },
          },
        ]);
        MeasurementType.findAll = findAllType;

        const findAllSensor = jest.fn();
        findAllSensor.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].sensor,
            },
          },
          {
            dataValues: {
              id: measurementsBulk[1].id,
              name: measurementsBulk[1].sensor,
            },
          },
        ]);
        Sensor.findAll = findAllSensor;

        const body = measurementsBulk;
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(207);
        expect(result.body.message).toStrictEqual(
          "Types not found: " +
            measurementsBulk[1].type +
            " on measurements: 1; Some measurements were created, but not all of them. Created: 1 of 2; "
        );
      });
      test("should return a 500 if one measurement with bad date is send", async () => {
        const bulkCreate = jest.fn();
        bulkCreate.mockResolvedValue(measurements);
        Measurement.bulkCreate = bulkCreate;

        const body = [
          {
            id: measurementsBulk[0].id,
            date: "fezfez",
            value: measurementsBulk[0].value,
            sensor: measurementsBulk[0].sensor,
          },
        ];
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(500);
        expect(result.body.message).toBe("Server error");
        expect(result.body.codeError).toBe("server.error");
      });
      test("should return a 500 if one measurement with bad value is send", async () => {
        const bulkCreate = jest.fn();
        bulkCreate.mockResolvedValue(measurements);
        Measurement.bulkCreate = bulkCreate;

        const body = [
          {
            id: measurementsBulk[0].id,
            type: measurementsBulk[0].type,
            date: measurementsBulk[0].date,
            value: "dzdzz",
            sensor: measurementsBulk[0].sensor,
          },
        ];
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(500);
        expect(result.body.message).toBe("Server error");
        expect(result.body.codeError).toBe("server.error");
      });
      test("should return a 500 if bad measurementType are find", async () => {
        const bulkCreate = jest.fn();
        bulkCreate.mockResolvedValue(measurements);
        Measurement.bulkCreate = bulkCreate;

        const findAllType = jest.fn();
        findAllType.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: "humidity",
            },
          },
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: "humidity",
            },
          },
        ]);
        MeasurementType.findAll = findAllType;

        const findAllSensor = jest.fn();
        findAllSensor.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].sensor,
            },
          },
          {
            dataValues: {
              id: measurementsBulk[1].id,
              name: measurementsBulk[1].sensor,
            },
          },
        ]);
        Sensor.findAll = findAllSensor;

        const body = measurementsBulk;
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(500);
        expect(result.body.message).toBe("Server error");
        expect(result.body.codeError).toBe("server.error");
      });
      test("should return a 500 if createMeasurement is empty", async () => {
        const bulkCreate = jest.fn();
        bulkCreate.mockResolvedValue([]);
        Measurement.bulkCreate = bulkCreate;

        const findAll = jest.fn();
        findAll.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].type,
            },
          },
          {
            dataValues: {
              id: measurementsBulk[1].id,
              name: measurementsBulk[1].type,
            },
          },
        ]);
        MeasurementType.findAll = findAll;

        const findAllSensor = jest.fn();
        findAllSensor.mockResolvedValue([
          {
            dataValues: {
              id: measurementsBulk[0].id,
              name: measurementsBulk[0].sensor,
            },
          },
          {
            dataValues: {
              id: measurementsBulk[1].id,
              name: measurementsBulk[1].sensor,
            },
          },
        ]);
        Sensor.findAll = findAllSensor;

        const body = measurementsBulk;
        const result = await superTest(app)
          .post(localBaseUri)
          .send(body)
          .set("Authorization", `Bearer 1234`);

        expect(result.status).toBe(500);
        expect(result.body.message).toBe("Server error");
        expect(result.body.codeError).toBe("server.error");
      });
    });

    test("should return a 403 if person is unauthorized", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.REGULAR });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;
      Sensor.findOne = findOneMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue([]);
      UserSensorAccess.findAll = findAllMock;

      const createMock = jest.fn();
      createMock.mockResolvedValue(measurements[0]);
      Measurement.create = createMock;

      const body = {
        date: "220101",
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(403);
      expect(result.body.message).toBe("You don't have access to this sensor");
      expect(result.body.codeError).toBe("measurement.sensor.forbidden");
    });

    test("should return a 404 if no sensor are found", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.REGULAR });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;
      Sensor.findOne = findOneMock;

      const createMock = jest.fn();
      createMock.mockResolvedValue(measurements[0]);
      Measurement.create = createMock;

      const body = {
        date: "220101",
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };
      const result = await superTest(app)
        .post(baseUri)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("No sensors found !");
      expect(result.body.codeError).toBe("measurement.sensor.not.found");
    });
  });

  describe("PUT /", () => {
    test("should return a 200 if everything is good", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;
      Sensor.findOne = findOneMock;

      const updateMock = jest.fn();
      updateMock.mockResolvedValue(measurements[0]);
      Measurement.update = updateMock;

      const body = {
        date: "2023-05-28 05:24:51",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        value: "1",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };

      const result = await superTest(app)
        .put(baseUri + "/" + measurements[0].id)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(200);
      expect(result.body).toStrictEqual(firstMeasurementJson);
    });

    test("should return a 404 if update dont find this measurement", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;
      Sensor.findOne = findOneMock;

      const updateMock = jest.fn();
      updateMock.mockResolvedValue(null);
      Measurement.update = updateMock;

      const body = {
        date: "2023-05-28 05:24:51",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        value: "1",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };

      const result = await superTest(app)
        .put(baseUri + "/" + measurements[0].id)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("Measurement not found");
      expect(result.body.codeError).toBe("measurement.not.found");
    });

    test("should return a 400 if date isn't provided", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const body = { date: "" };

      const result = await superTest(app)
        .put(baseUri + "/" + measurements[0].id)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Date is required");
      expect(result.body.codeError).toBe("measurement.date.required");
    });

    test("should return a 404 if sensor isn't correct", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;

      const findOneSensorMock = jest.fn();
      findOneSensorMock.mockResolvedValue(null);
      Sensor.findOne = findOneSensorMock;

      const body = {
        date: new Date(),
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };

      const result = await superTest(app)
        .put(baseUri + "/" + measurements[0].id)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("Sensor not found");
      expect(result.body.codeError).toBe("measurement.sensor.not.found");
    });

    test("should return a 500 if findOne sensor return an error not standard", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;

      const findOneSensorMock = jest.fn();
      findOneSensorMock.mockRejectedValue(new Error("Server error"));
      Sensor.findOne = findOneSensorMock;

      const body = {
        date: new Date(),
        value: "1",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };

      const result = await superTest(app)
        .put(baseUri + "/" + measurements[0].id)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });

    test("should return a 500 if update return nothing", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;
      Sensor.findOne = findOneMock;

      const updateMock = jest.fn();
      updateMock.mockRejectedValueOnce(new Error("Server error"));
      Measurement.update = updateMock;

      const body = {
        date: "2023-05-28 05:24:51",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        value: "1",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };

      const result = await superTest(app)
        .put(baseUri + "/" + measurements[0].id)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });

    test("should return a 401 if the token payload is null", async () => {
      // Decoding is now owned by the auth middleware; a null payload is a 401.
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue(null);
      jwt.verify = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;
      Sensor.findOne = findOneMock;

      const updateMock = jest.fn();
      updateMock.mockRejectedValueOnce(new Error("Server error"));
      Measurement.update = updateMock;

      const body = {
        date: "2023-05-28 05:24:51",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        value: "1",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };

      const result = await superTest(app)
        .put(baseUri + "/" + measurements[0].id)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(401);
      expect(result.body.message).toBe("Unauthorized !");
      expect(result.body.codeError).toBe("auth.token.invalid");
    });

    test("should return a 500 if decode throw an error", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      const decodeMock = jest.fn();
      decodeMock.mockRejectedValue(new Error());
      jwt.decode = decodeMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;
      Sensor.findOne = findOneMock;

      const updateMock = jest.fn();
      updateMock.mockRejectedValueOnce(new Error("Server error"));
      Measurement.update = updateMock;

      const body = {
        date: "2023-05-28 05:24:51",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        value: "1",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };

      const result = await superTest(app)
        .put(baseUri + "/" + measurements[0].id)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });

    test("should return a 403 if user is unauthorized", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.REGULAR });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;
      Sensor.findOne = findOneMock;

      const updateMock = jest.fn();
      updateMock.mockRejectedValueOnce(new Error("Server error"));
      Measurement.update = updateMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue([]);
      UserSensorAccess.findAll = findAllMock;

      const body = {
        date: "2023-05-28 05:24:51",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        value: "1",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };

      const result = await superTest(app)
        .put(baseUri + "/" + measurements[0].id)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(403);
      expect(result.body.message).toBe("You don't have access to this sensor");
      expect(result.body.codeError).toBe("measurement.sensor.forbidden");
    });

    test("should return a 404 if no sensor found", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.REGULAR });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findOneMock = jest.fn();
      findOneMock.mockResolvedValue({
        dataValues: { id: "aa9bce42-0bfd-4412-ad24-6372e6a2c139" },
      });
      MeasurementType.findOne = findOneMock;
      Sensor.findOne = findOneMock;

      const updateMock = jest.fn();
      updateMock.mockRejectedValueOnce(new Error("Server error"));
      Measurement.update = updateMock;

      const body = {
        date: "2023-05-28 05:24:51",
        type: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
        value: "1",
        sensor: "aa9bce42-0bfd-4412-ad24-6372e6a2c139",
      };

      const result = await superTest(app)
        .put(baseUri + "/" + measurements[0].id)
        .send(body)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("No sensors found !");
      expect(result.body.codeError).toBe("measurement.sensor.not.found");
    });
  });

  describe("DELETE /", () => {
    test("should return a 400 if no id isn't valid", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const result = await superTest(app)
        .delete(baseUri + "/1")
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Id is not valid");
      expect(result.body.codeError).toBe("measurement.id.not.uuid");
    });

    test("should return a 404 if measurement is not found", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const destroyMock = jest.fn();
      destroyMock.mockResolvedValue(null);
      Measurement.destroy = destroyMock;

      const result = await superTest(app)
        .delete(baseUri + "/" + measurements[0].id)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("Measurement not found");
      expect(result.body.codeError).toBe("measurement.not.found");
    });

    test("should return a 500 if destroy throw an error", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const destroyMock = jest.fn();
      destroyMock.mockRejectedValue(new Error());
      Measurement.destroy = destroyMock;

      const result = await superTest(app)
        .delete(baseUri + "/" + measurements[0].id)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });

    test("should return a 200 if everything is good", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const destroyMock = jest.fn();
      destroyMock.mockResolvedValue(measurements[0]);
      Measurement.destroy = destroyMock;

      const result = await superTest(app)
        .delete(baseUri + "/" + measurements[0].id)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(firstMeasurementJson);
    });

    test("should return a 401 if the token payload is null", async () => {
      // Decoding is now owned by the auth middleware; a null payload is a 401.
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue(null);
      jwt.verify = verifyMock;

      const destroyMock = jest.fn();
      destroyMock.mockResolvedValue(measurements[0]);
      Measurement.destroy = destroyMock;

      const result = await superTest(app)
        .delete(baseUri + "/" + measurements[0].id)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(401);
      expect(result.body.message).toBe("Unauthorized !");
      expect(result.body.codeError).toBe("auth.token.invalid");
    });

    test("should return a 500 if the middleware token verification throws", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockImplementation(() => {
        throw new Error();
      });
      jwt.verify = verifyMock;

      const destroyMock = jest.fn();
      destroyMock.mockResolvedValue(measurements[0]);
      Measurement.destroy = destroyMock;

      const result = await superTest(app)
        .delete(baseUri + "/" + measurements[0].id)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error !");
      expect(result.body.codeError).toBe("server.error");
    });

    test("should return a 403 if user is unauthorized", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.REGULAR });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const destroyMock = jest.fn();
      destroyMock.mockResolvedValue(measurements[0]);
      Measurement.destroy = destroyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue([]);
      UserSensorAccess.findAll = findAllMock;

      const result = await superTest(app)
        .delete(baseUri + "/" + measurements[0].id)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(403);
      expect(result.body.message).toBe("You don't have access to this sensor");
      expect(result.body.codeError).toBe("measurement.sensor.forbidden");
    });

    test("should return a 404 if no sensor found", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.REGULAR });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const destroyMock = jest.fn();
      destroyMock.mockResolvedValue(measurements[0]);
      Measurement.destroy = destroyMock;

      const result = await superTest(app)
        .delete(baseUri + "/" + measurements[0].id)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("No sensors found !");
      expect(result.body.codeError).toBe("measurement.sensor.not.found");
    });
  });

  describe("GET /", () => {
    test("should return a 200 with all measurements if nothing is provided", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurements);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(measurementsJson);
    });

    test("should return a 200 with the measurement with the associated id", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurements[0]);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri + "/d15bc110-45c6-4c58-a07e-0b95a1de46a4")
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(firstMeasurementJson);
    });

    test("should return a 500 if findAll throw an error", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockRejectedValue(new Error());
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });

    test("should return a 404 if no measurement is found", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue([]);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(404);
      expect(result.body.message).toBe("Measurement not found");
      expect(result.body.codeError).toBe("measurement.not.found");
    });

    test("should return a 200 if everything is well asked", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurements[0]);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(
          baseUri +
            "/d15bc110-45c6-4c58-a07e-0b95a1de46a4?type=speed&sensor=esp32/695b&number=1"
        )
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(firstMeasurementJson);
    });

    test("should return a 400 if number isn't valid", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const result = await superTest(app)
        .get(baseUri + "/d15bc110-45c6-4c58-a07e-0b95a1de46a4?number=a")
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Number is not valid");
      expect(result.body.codeError).toBe("measurement.number.not.valid");
    });

    test("should return a 400 if date isn't valid", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const result = await superTest(app)
        .get(baseUri + "/d15bc110-45c6-4c58-a07e-0b95a1de46a4?date=a")
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Date is not valid");
      expect(result.body.codeError).toBe("measurement.date.not.valid");
    });

    test("should return a 200 if date is valid", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurements[0]);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri + "/d15bc110-45c6-4c58-a07e-0b95a1de46a4?date=2022")
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(firstMeasurementJson);
    });

    test("should return a bad request if sample is present but not valid", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurements[0]);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(
          baseUri +
            "/d15bc110-45c6-4c58-a07e-0b95a1de46a4?sample=1,2,3&sample=4,5,6"
        )
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Sample time is not valid");
      expect(result.body.codeError).toBe("measurement.sample.time.not.valid");
    });

    test("should return a bad request if sample is not present and average is present and valid", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurements[0]);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(
          baseUri +
            "/d15bc110-45c6-4c58-a07e-0b95a1de46a4?average=1,2,3&average=4,5,6"
        )
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Sample time is required");
      expect(result.body.codeError).toBe("measurement.sample.time.required");
    });

    test("should return a bad request if sample is not present and average is present", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurements[0]);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri + "/d15bc110-45c6-4c58-a07e-0b95a1de46a4?average=weekly")
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Sample time is required");
      expect(result.body.codeError).toBe("measurement.sample.time.required");
    });

    test("should return a bad request if sample is present and valid and average is present and not valid", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurements);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(
          baseUri +
            "/d15bc110-45c6-4c58-a07e-0b95a1de46a4?sample=daily&average=1,2,3&average=4,5,6"
        )
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Average is not valid");
      expect(result.body.codeError).toBe("measurement.average.not.valid");
    });

    test("should return a result sampled if sample is present and valid and average is either not present or present and valid", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurementsDataValues);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri + "?sample=weekly&average=true")
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(measurementsDataValuesJson);
    });

    test("should return a result sampled if sample is present and valid and average is either not present or present and valid", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurementsDataValues);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri + "?sample=weekly")
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(measurementsDataValuesJson);
    });

    test("should return a 400 if getSample is called with an invalid sample", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurementsDataValues);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri + "?sample=invalidSample")
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(400);
      expect(result.body.message).toBe("Sample time is not valid");
      expect(result.body.codeError).toBe("measurement.sample.not.valid");
    });

    test("should return a 200 if getSample is called with a valid sample and there is only one measurement", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue({ dataValues: measurements[0] });
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri + "?sample=weekly")
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(firstMeasurementJson2);
    });

    test("should return a 500 if something throws a server error", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue({ id: "id-34", role: Role.ADMIN });
      jwt.verify = verifyMock;
      jwt.decode = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockRejectedValue(
        new ServerErrorException("Server error", "server.error")
      );
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(baseUri)
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error");
      expect(result.body.codeError).toBe("server.error");
    });

    test("should return a 401 if the token payload is null", async () => {
      // Decoding is now owned by the auth middleware; a null payload is a 401.
      const verifyMock = jest.fn();
      verifyMock.mockReturnValue(null);
      jwt.verify = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurements[0]);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(
          baseUri +
            "/d15bc110-45c6-4c58-a07e-0b95a1de46a4?type=speed&sensor=esp32/695b&number=1"
        )
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(401);
      expect(result.body.message).toBe("Unauthorized !");
      expect(result.body.codeError).toBe("auth.token.invalid");
    });

    test("should return a 500 if the middleware token verification throws", async () => {
      const verifyMock = jest.fn();
      verifyMock.mockImplementation(() => {
        throw new Error();
      });
      jwt.verify = verifyMock;

      const findAllMock = jest.fn();
      findAllMock.mockResolvedValue(measurements[0]);
      Measurement.findAll = findAllMock;

      const result = await superTest(app)
        .get(
          baseUri +
            "/d15bc110-45c6-4c58-a07e-0b95a1de46a4?type=speed&sensor=esp32/695b&number=1"
        )
        .set("Authorization", `Bearer 1234`);

      expect(result.status).toBe(500);
      expect(result.body.message).toBe("Server error !");
      expect(result.body.codeError).toBe("server.error");
    });
  });
});

const generateMockMeasurements = (
  count: number,
  interval: number
): MeasurementModelModel[] => {
  const measurements = [];
  const now = new Date("2023-06-18T15:28:21.120Z");

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now.getTime() - i * interval);

    measurements.push({
      dataValues: {
        id: i.toString(),
        timestamp,
        value: i + 1,
      },
    });
  }
  return measurements as MeasurementModelModel[];
};

const secondsInMinute = 60;
const minutesInHour = 60;
const hoursInDay = 24;
const daysInWeek = 7;
const weeksInMonth = 4;
const monthsInYear = 12;
const yearsInDecade = 10;
const decadesInCentury = 10;
const centuriesInMillennium = 10;

const seconds = 1000;
const minutes = secondsInMinute * seconds;
const hours = minutesInHour * minutes;
const days = hoursInDay * hours;
const weeks = daysInWeek * days;
const months = weeksInMonth * weeks;
const years = monthsInYear * months;
const decades = yearsInDecade * years;
const centuries = decadesInCentury * decades;

const coefficient = 10;
const count = [
  coefficient * secondsInMinute,
  coefficient * minutesInHour,
  coefficient * hoursInDay,
  coefficient * daysInWeek,
  coefficient * weeksInMonth,
  coefficient * monthsInYear,
  coefficient * yearsInDecade,
  coefficient * decadesInCentury,
  coefficient * centuriesInMillennium,
];

const mockMeasurements = [
  generateMockMeasurements(count[0], seconds), // 10 minutes of data with 1 second interval
  generateMockMeasurements(count[1], minutes), // 10 hours of data with 1 minute interval
  generateMockMeasurements(count[2], hours), // 10 days of data with 1 hour interval
  generateMockMeasurements(count[3], days), // 10 weeks of data with 1-day interval
  generateMockMeasurements(count[4], weeks), // 10 months of data with 1-week interval
  generateMockMeasurements(count[5], months), // 10 years of data with 1-month interval
  generateMockMeasurements(count[6], years), // 10 decades of data with 1-year interval
  generateMockMeasurements(count[7], decades), // 10 centuries of data with 1-decade interval
  generateMockMeasurements(count[8], centuries), // 10 millenniums of data with 1-century interval
];
const timestamp = new Date("2023-06-18T12:34:56"); // Use a specific timestamp for testing

describe("Auxiliary functions", () => {
  describe("formatKey", () => {
    test("should format key correctly for 'second' format", () => {
      const format = "second";
      const expected = "56";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'midMinute' format", () => {
      const format = "midMinute";
      const expected = "1";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'minute' format", () => {
      const format = "minute";
      const expected = "34";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'quarterHour' format", () => {
      const format = "quarterHour";
      const expected = "2";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'halfHour' format", () => {
      const format = "halfHour";
      const expected = "1";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'hour' format", () => {
      const format = "hour";
      const expected = "12";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'day' format", () => {
      const format = "day";
      const expected = "18";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'week' format", () => {
      const format = "week";
      const expected = "2";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'fortnight' format", () => {
      const format = "fortnight";
      const expected = "1";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'month' format", () => {
      const format = "month";
      const expected = "5";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'quarter' format", () => {
      const format = "quarter";
      const expected = "1";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'halfYear' format", () => {
      const format = "halfYear";
      const expected = "0";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'year' format", () => {
      const format = "year";
      const expected = "2023";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });

    test("should format key correctly for 'decade' format", () => {
      const format = "decade";
      const expected = "202";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });
    test("should format key correctly for 'century' format", () => {
      const format = "century";
      const expected = "20";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });
    test("should format key correctly for 'millennium' format", () => {
      const format = "millennium";
      const expected = "2";
      const result = formatKey(format, timestamp);
      expect(result).toBe(expected);
    });
  });
  describe("getSample", () => {
    describe("Without averaging", () => {
      test("should throw an error for invalid format", () => {
        const format = "invalid";
        expect(() => {
          formatKey(format, timestamp);
        }).toThrow("Invalid time part: " + format);
      });
    });
    describe("getSample", () => {
      describe("Without averaging", () => {
        test("should return sample for secondly measurements", () => {
          const result = getSample({
            result: mockMeasurements[0],
            sample: "secondly",
          });

          const length = coefficient * secondsInMinute;

          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[0]); // The latest value
        });
        test("should return sample for mid minutely measurements", () => {
          const result = getSample({
            result: mockMeasurements[0],
            sample: "midMinutely",
          });
          const length =
            (coefficient * secondsInMinute) / (secondsInMinute / 2) + 1;

          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[0] - 7); // The latest value
        });
        test("should return sample for minutely measurements", () => {
          const result = getSample({
            result: mockMeasurements[1],
            sample: "minutely",
          });
          const length = coefficient * minutesInHour;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(length); // The latest value
        });
        test("should return sample for quarter hourly measurements", () => {
          const result = getSample({
            result: mockMeasurements[1],
            sample: "quarterHourly",
          });
          const length =
            (coefficient * minutesInHour) / (minutesInHour / 4) + 1;

          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[1]); // The latest value
        });
        test("should return sample for half hourly measurements", () => {
          const result = getSample({
            result: mockMeasurements[1],
            sample: "halfHourly",
          });

          const length =
            (coefficient * minutesInHour) / (minutesInHour / 2) + 1;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[1]); // The latest value
        });
        test("should return sample for hourly measurements", () => {
          const result = getSample({
            result: mockMeasurements[2],
            sample: "hourly",
          });

          const length = coefficient * hoursInDay;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[2]); // The latest value
        });
        test("should return sample for daily measurements", () => {
          const result = getSample({
            result: mockMeasurements[3],
            sample: "daily",
          });
          const length = coefficient * daysInWeek;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[3]); // The latest value
        });
        test("should return sample for weekly measurements", () => {
          const result = getSample({
            result: mockMeasurements[4],
            sample: "weekly",
          });
          const length = (coefficient * weeksInMonth) / (weeksInMonth / 4);
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[4]); // The latest value
        });
        test("should return sample for fortnightly measurements", () => {
          const result = getSample({
            result: mockMeasurements[4],
            sample: "fortnightly",
          });
          const length = (coefficient * weeksInMonth) / (weeksInMonth / 2) + 1;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[4] - 1); // The latest value
        });
        test("should return sample for monthly measurements", () => {
          const result = getSample({
            result: mockMeasurements[5],
            sample: "monthly",
          });
          const length = coefficient * monthsInYear - 10;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[5]); // The latest value
        });
        test("should return sample for quarterly measurements", () => {
          const result = getSample({
            result: mockMeasurements[5],
            sample: "quarterly",
          });
          const length = (coefficient * monthsInYear) / (monthsInYear / 4) - 3;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[5] - 2); // The latest value
        });
        test("should return sample for half yearly measurements", () => {
          const result = getSample({
            result: mockMeasurements[5],
            sample: "halfYearly",
          });
          const length = (coefficient * monthsInYear) / (monthsInYear / 2) - 1;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[5] - 2); // The latest value
        });
        test("should return sample for yearly measurements", () => {
          const result = getSample({
            result: mockMeasurements[6],
            sample: "yearly",
          });
          const length = coefficient * yearsInDecade - 8;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[6]); // The latest value
        });
        test("should return sample for decade measurements", () => {
          const result = getSample({
            result: mockMeasurements[7],
            sample: "decade",
          });
          const length = coefficient * decadesInCentury - 8;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[7]); // The latest value
        });
        test("should return sample for century measurements", () => {
          const result = getSample({
            result: mockMeasurements[8],
            sample: "century",
          });
          const length = coefficient * centuriesInMillennium - 8;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[8]); // The latest value
        });
        test("should return sample for millennium measurements", () => {
          const result = getSample({
            result: mockMeasurements[8],
            sample: "millennium",
          });
          const length = coefficient + 1;
          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(count[8]); // The latest value
        });
        test("should return a bad request error if the sample is invalid", () => {
          expect(() =>
            getSample({ result: mockMeasurements[0], sample: "invalid" })
          ).toThrow("Sample time is not valid");
        });
      });
      describe("With average", () => {
        test("should return bad request error if average is invalid", () => {
          expect(() =>
            getSample({
              result: mockMeasurements[0],
              sample: "daily",
              average: "invalid",
            })
          ).toThrow("Measurement average not valid");
        });
        test("should return sample for daily measurements with average", () => {
          const result = getSample({
            result: generateMockMeasurements(100, 100), // 100 measurements with 100ms interval
            sample: "secondly",
            average: "true",
          });

          const length = 11;

          expect(result).toHaveLength(length);
          expect(result[0].dataValues.value).toBe(1.5); // The oldest value
          expect(result[length - 1].dataValues.value).toBe(99.0078125); // The latest value
        });
      });
    });
  });
});
