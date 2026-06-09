import { Op } from "sequelize";
import {
  createSensorData,
  getSensorDataWithinTimeRange,
  deleteSensorDataWithinTimeRange,
} from "@controllers/sensorData";
import { BadRequestException, ServerErrorException } from "@/utils/exceptions";
// Model(s) import
import db from "@db/index";
const DB: any = db;
const { sensordata } = DB; // PLEASE BARE IN MIND THAT TIME SERIES DATATABLE IS WRITTEN IN LOWERCASE
// --- End of model(s) import

jest.mock("@db/index", () => ({
  // Due to the establishment of associations with RAMI1, the models are now imported from the db
  // Since the models all appear in the database from @db/index, we ONLY MAKE one mock from the db!
  sensordata: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
}));

describe("SensorData Controller", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("createSensorData", () => {
    it("should create sensor data with provided microseconds time", async () => {
      const idSensor = "sensor1";
      const time = 1721122942092696;
      const value = 42;

      const mockSensorData = {
        idSensor,
        time: new Date(Math.floor(time / 1000)),
        value,
      };
      sensordata.create.mockResolvedValue(mockSensorData);

      await createSensorData(idSensor, time, value);

      expect(sensordata.create).toHaveBeenCalledWith({
        idSensor,
        time: new Date(Math.floor(time / 1000)),
        value,
      });
    });

    it("should throw BadRequestException for negative time parameter", async () => {
      try {
        await createSensorData("sensor1", -1, 42);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.codeError).toBe("sensor.data.time.not.positif.number");
        }
      }
    });

    it("should throw BadRequestException for not 16 digits long time parameter", async () => {
      try {
        await createSensorData("sensor1", 17413254277299, 42);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.codeError).toBe("sensor.data.time.not.16.digits.long");
        }
      }
    });

    it("should throw BadRequestException if sensor data time is older than 2024", async () => {
      try {
        await createSensorData("sensor1", 1567836800000000, 42);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.codeError).toBe("sensor.data.time.too.old");
        }
      }
    });

    it("should throw ServerErrorException when there is a database error", async () => {
      const idSensor = "sensor1";
      const time = 1721122942092696; // Un timestamp valide
      const value = 42;

      // Simuler une erreur lors de l'appel à sensordata.create
      sensordata.create.mockRejectedValue(new Error("Database error"));

      await expect(
        createSensorData(idSensor, time, value)
      ).rejects.toBeInstanceOf(ServerErrorException);
      await expect(
        createSensorData(idSensor, time, value)
      ).rejects.toMatchObject({
        message: "Server error !",
        codeError: "server.error",
      });
    });
  });

  describe("getSensorDataWithinTimeRange", () => {
    it("should get all sensor data if no time range is provided", async () => {
      const idSensor = "sensor1";
      const mockSensorData = [
        { idSensor, time: new Date(), value: 42 },
        { idSensor, time: new Date(), value: 43 },
      ];
      sensordata.findAll.mockResolvedValue(mockSensorData);

      const result = await getSensorDataWithinTimeRange(idSensor);

      expect(sensordata.findAll).toHaveBeenCalledWith({
        where: { idSensor },
        order: [["time", "ASC"]],
        include: { model: undefined, attributes: ["name"] },
      });
      expect(result).toEqual(mockSensorData);
    });

    it("should get sensor data within the specified time range", async () => {
      const idSensor = "sensor1";
      const time1 = new Date("2023-01-01T00:00:00Z");
      const time2 = new Date("2023-01-02T00:00:00Z");
      const mockSensorData = [
        { idSensor, time: new Date("2023-01-01T12:00:00Z"), value: 42 },
      ];
      sensordata.findAll.mockResolvedValue(mockSensorData);

      const result = await getSensorDataWithinTimeRange(idSensor, time1, time2);

      expect(sensordata.findAll).toHaveBeenCalledWith({
        where: {
          idSensor,
          time: {
            [Op.between]: [time1, time2],
          },
        },
        order: [["time", "ASC"]],
        include: { model: undefined, attributes: ["name"] },
      });
      expect(result).toEqual(mockSensorData);
    });

    it("should throw BadRequestException if only time1 is provided", async () => {
      const idSensor = "sensor1";
      const time1 = new Date();

      try {
        await getSensorDataWithinTimeRange(idSensor, time1);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.codeError).toBe(
            "sensor.data.one.time.parameter.missing"
          );
        }
      }
    });

    it("should throw BadRequestException if time1 or time2 is not positive", async () => {
      const idSensor = "sensor1";
      const time1 = new Date(-1);
      const time2 = new Date();

      try {
        await getSensorDataWithinTimeRange(idSensor, time1, time2);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.codeError).toBe("sensor.data.time.not.positif.number");
        }
      }
    });

    it("should throw BadRequestException if time1 is greater than or equal to time2", async () => {
      const idSensor = "sensor1";
      const time1 = new Date(1721122942092696);
      const time2 = new Date(1721122942092695);

      try {
        await getSensorDataWithinTimeRange(idSensor, time1, time2);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.codeError).toBe(
            "sensor.data.time.last.parameter.should.be.greater.than.first.one"
          );
        }
      }
    });

    it("should throw ServerErrorException when there is a database error", async () => {
      const idSensor = "sensor1";
      const time1 = new Date(1721122942092696);
      const time2 = new Date(1721122942092700);

      // Simulate a database error
      sensordata.findAll.mockRejectedValue(new Error("Database error"));

      await expect(
        getSensorDataWithinTimeRange(idSensor, time1, time2)
      ).rejects.toBeInstanceOf(ServerErrorException);
      await expect(
        getSensorDataWithinTimeRange(idSensor, time1, time2)
      ).rejects.toMatchObject({
        message: "Server error!",
        codeError: "server.error",
      });
    });
  });

  describe("deleteSensorDataWithinTimeRange", () => {
    it("should delete all sensor data if no time range is provided", async () => {
      const idSensor = "sensor1";
      sensordata.destroy.mockResolvedValue(2); // Assuming 2 records deleted

      const result = await deleteSensorDataWithinTimeRange(idSensor);

      expect(sensordata.destroy).toHaveBeenCalledWith({
        where: { idSensor },
      });
      expect(result).toEqual(2);
    });

    it("should delete sensor data within the specified time range", async () => {
      const idSensor = "sensor1";
      const time1 = new Date("2023-01-01T00:00:00Z");
      const time2 = new Date("2023-01-02T00:00:00Z");
      sensordata.destroy.mockResolvedValue(1); // Assuming 1 record deleted

      const result = await deleteSensorDataWithinTimeRange(
        idSensor,
        time1,
        time2
      );

      expect(sensordata.destroy).toHaveBeenCalledWith({
        where: {
          idSensor,
          time: {
            [Op.between]: [time1, time2],
          },
        },
      });
      expect(result).toEqual(1);
    });

    it("should throw BadRequestException if only time1 is provided", async () => {
      const idSensor = "sensor1";
      const time1 = new Date();

      try {
        await deleteSensorDataWithinTimeRange(idSensor, time1);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.codeError).toBe(
            "sensor.data.one.time.parameter.missing"
          );
        }
      }
    });

    it("should throw BadRequestException if time1 or time2 is not positive", async () => {
      const idSensor = "sensor1";
      const time1 = new Date(-1);
      const time2 = new Date();

      try {
        await deleteSensorDataWithinTimeRange(idSensor, time1, time2);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.codeError).toBe("sensor.data.time.not.positif.number");
        }
      }
    });

    it("should throw BadRequestException if time1 is greater than or equal to time2", async () => {
      const idSensor = "sensor1";
      const time1 = new Date(1721122942092696);
      const time2 = new Date(1721122942092695);

      try {
        await deleteSensorDataWithinTimeRange(idSensor, time1, time2);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.codeError).toBe(
            "sensor.data.time.last.parameter.should.be.greater.than.first.one"
          );
        }
      }
    });

    it("should throw ServerErrorException when there is a database error", async () => {
      const idSensor = "sensor1";
      const time1 = new Date(1721122942092696);
      const time2 = new Date(1721122942092700);

      // Simulate a database error
      sensordata.destroy.mockRejectedValue(new Error("Database error"));

      await expect(
        deleteSensorDataWithinTimeRange(idSensor, time1, time2)
      ).rejects.toBeInstanceOf(ServerErrorException);
      await expect(
        deleteSensorDataWithinTimeRange(idSensor, time1, time2)
      ).rejects.toMatchObject({
        message: "Server error!",
        codeError: "server.error",
      });
    });
  });
});
