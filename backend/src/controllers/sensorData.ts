import { Op, QueryTypes } from "sequelize";
// Model import
import db from "@db/index";
import { BadRequestException, ServerErrorException } from "@/utils/exceptions";
const DB: any = db;
const { sensordata, MeasurementType } = DB;
// --- end of model import
/*
Details regarding CRUD operations:
Please note, the logic regarding CRD operations for the sensordata model is concentrated here.
Also, it is considered that there is no need to update data received by the sensor.
ATTENTION, we deal with the error concerning the logic of CRD operations. In other words,
here we will check all the parameters except the IDs which must be checked by the controllers calling the functions present here
*/

// -------------------------------------------- CHECK AND UTILITY FONCTIONS --------------------------------------------

interface SensorDataWhereClause {
  idSensor: string;
  time?: {
    [Op.between]?: [Date, Date];
  };
}

const buildSensorDataWhereClause = (
  idSensor: string,
  time1?: Date,
  time2?: Date
): SensorDataWhereClause => {
  // Initialize the where clause for the query with the sensor ID.
  const whereClause: SensorDataWhereClause = { idSensor: idSensor };

  // Verify if time1 is provided, time2 must also be provided.
  if (time1 && !time2) {
    throw new BadRequestException(
      "Both 'time1' and 'time2' must be provided if 'time1' is provided.",
      "sensor.data.one.time.parameter.missing"
    );
  }

  // Verify that time1 and time2 are positive.
  if (time1 && time2) {
    if (time1.getTime() <= 0 || time2.getTime() <= 0) {
      throw new BadRequestException(
        "Both 'time1' and 'time2' must be positive.",
        "sensor.data.time.not.positif.number"
      );
    }

    // Verify that time1 is less than time2.
    if (time1 >= time2) {
      throw new BadRequestException(
        "'time2' should be greater than 'time1'.",
        "sensor.data.time.last.parameter.should.be.greater.than.first.one"
      );
    }

    // Add a between condition for the time.
    whereClause.time = {
      [Op.between]: [time1, time2],
    };
  }

  return whereClause;
};

// ----------------------------------------- CONTROLLER FUNCTIONS ---------------------------------------------

/**
 * Create a new sensor data entry.
 *
 * @param {string} idSensor - The ID of the sensor.
 * @param {number} [time] The time of the sensor data in Unix timestamp format [UNIT: MICROSECONDS, example: 1721122942092696]
 * @param {number} value - The value of the sensor data.
 * @throws {BadRequestException} - Throws an error if:
 *   - `time` is not a number or is not positive ("sensor.data.time.not.positif.number").
 *   - `time` is not a 16-digit number ("sensor.data.time.not.16.digits.long").
 *   - `time` is before 2024 ("sensor.data.time.too.old").
 *   - `value` is not a number ("sensor.data.value.invalid").
 * @throws {ServerErrorException} - Throws an error if there is a problem with the database operation ("server.error").
 */
const createSensorData = async (
  idSensor: string,
  time: number,
  value: number,
  idMeasurementType: string
) => {
  const MINIMUM_TIME_IN_MICROSECONDS = 1704067200000000; // Corresponding to 2024-01-01T00:00:00.000Z en microsecondes

  if (typeof time !== "number" || time <= 0) {
    throw new BadRequestException(
      "The 'time' must be positif",
      "sensor.data.time.not.positif.number"
    );
  }

  if (time.toString().length !== 16) {
    throw new BadRequestException(
      "The 'time' must be a positive Unix timestamp in microseconds with 16 digits.",
      "sensor.data.time.not.16.digits.long"
    );
  }

  if (time < MINIMUM_TIME_IN_MICROSECONDS) {
    throw new BadRequestException(
      "The 'time' must be after 2020.",
      "sensor.data.time.too.old"
    );
  }

  if (typeof value !== "number") {
    throw new BadRequestException(
      "The 'value' must be a number",
      "sensor.data.value.invalid"
    );
  }
  // Convert the Unix timestamp to a JavaScript Date object
  // THE TIMESTAMP FORMAT MUST BE MICROSECONDS AND IS LIKE: 1721122942092696
  const timestampInMilliseconds = Math.floor(time / 1000);
  const timestamp = new Date(timestampInMilliseconds);

  // Create a new entry in the SensorData table with the provided sensor ID, value, and time.
  try {
    await sensordata.create({
      idSensor: idSensor,
      time: timestamp,
      value: value,
      idMeasurementType: idMeasurementType,
    });
  } catch (error) {
    throw new ServerErrorException("Server error !", "server.error");
  }
};

/**
 * Get sensor data entries within a specified time range.
 *
 * @param {string} idSensor - The ID of the sensor.
 * @param {Date} [time1] - Optional. The start time of the range. If not provided, fetch all data.
 * @param {Date} [time2] - Optional. The end time of the range. If not provided, fetch all data.
 * @returns {Promise<Array<Object>>} - An array of sensor data objects.
 * @throws {BadRequestException} - Throws an error if:
 *   - Only `time1` is provided without `time2` ("sensor.data.one.time.parameter.missing").
 *   - `time1` or `time2` is not positive ("sensor.data.time.not.positif.number").
 *   - `time1` is greater than or equal to `time2` ("sensor.data.time.last.parameter.should.be.greater.than.first.one").
 * @throws {ServerErrorException} - Throws an error if there is a problem with the database operation ("server.error").
 */
const getSensorDataWithinTimeRange = async (
  idSensor: string,
  time1?: Date,
  time2?: Date,
  limit?: number // undefined = pas de limite (export CSV uniquement)
) => {
  // Build the where clause using the utility function.
  const whereClause = buildSensorDataWhereClause(idSensor, time1, time2);

  const query: any = {
    where: whereClause,
    order: [["time", "ASC"]],
    include: {
      model: MeasurementType,
      attributes: ["name"],
    },
  };
  if (limit !== undefined) query.limit = limit;

  try {
    // Query the SensorData table with the constructed where clause.
    const sensorData = await sensordata.findAll(query);

    // Return the array of sensor data objects.
    return sensorData;
  } catch (error) {
    throw new ServerErrorException("Server error!", "server.error");
  }
};

/**
 * Delete sensor data entries within a specified time range.
 *
 * @param {string} idSensor - The ID of the sensor.
 * @param {Date} [time1] - Optional. The start time of the range. If not provided, delete all data.
 * @param {Date} [time2] - Optional. The end time of the range. If not provided, delete all data.
 * @returns {Promise<number>} - The number of deleted rows.
 * @throws {BadRequestException} - Throws an error if:
 *   - Only `time1` is provided without `time2` ("sensor.data.one.time.parameter.missing").
 *   - `time1` or `time2` is not positive ("sensor.data.time.not.positif.number").
 *   - `time1` is greater than or equal to `time2` ("sensor.data.time.last.parameter.should.be.greater.than.first.one").
 * @throws {ServerErrorException} - Throws an error if there is a problem with the database operation ("server.error").
 */
const deleteSensorDataWithinTimeRange = async (
  idSensor: string,
  time1?: Date,
  time2?: Date
) => {
  // Build the where clause using the utility function.
  const whereClause = buildSensorDataWhereClause(idSensor, time1, time2);

  try {
    // Execute the delete operation on the SensorData table with the constructed where clause.
    const deleteCount = await sensordata.destroy({
      where: whereClause,
    });

    // Return the number of deleted rows.
    return deleteCount;
  } catch (error) {
    // Throw a new error indicating an internal server error.
    throw new ServerErrorException("Server error!", "server.error");
  }
};

/**
 * Get downsampled sensor data using TimescaleDB time_bucket aggregation.
 * Returns at most `maxPoints` buckets by averaging values within each bucket.
 *
 * @param {string} idSensor - The ID of the sensor.
 * @param {Date} time1 - Start of the time range.
 * @param {Date} time2 - End of the time range.
 * @param {number} maxPoints - Maximum number of data points to return per measurement type.
 * @throws {ServerErrorException} - Throws an error if there is a problem with the database operation.
 */
const getDownsampledSensorData = async (
  idSensor: string,
  time1: Date,
  time2: Date,
  maxPoints: number
) => {
  const durationSeconds = Math.max(
    1,
    (time2.getTime() - time1.getTime()) / 1000
  );
  const bucketSeconds = Math.max(1, Math.ceil(durationSeconds / maxPoints));

  try {
    const results = await DB.sequelize.query(
      `SELECT
         time_bucket(make_interval(secs => :bucketSeconds), sd.time) AS time,
         sd."idSensor",
         sd."idMeasurementType",
         AVG(sd.value) AS value,
         mt.name AS "MeasurementTypeName"
       FROM sensordata sd
       JOIN "MeasurementTypes" mt ON sd."idMeasurementType" = mt.id
       WHERE sd."idSensor" = :idSensor
         AND sd.time BETWEEN :time1 AND :time2
       GROUP BY 1, sd."idSensor", sd."idMeasurementType", mt.name
       ORDER BY 1`,
      {
        replacements: { bucketSeconds, idSensor, time1, time2 },
        type: QueryTypes.SELECT,
      }
    );

    return (results as any[]).map((row: any) => ({
      time: row.time,
      value: parseFloat(row.value),
      idSensor: row.idSensor,
      idMeasurementType: row.idMeasurementType,
      MeasurementType: { name: row.MeasurementTypeName },
    }));
  } catch (error) {
    throw new ServerErrorException("Server error!", "server.error");
  }
};

export {
  createSensorData,
  getSensorDataWithinTimeRange,
  getDownsampledSensorData,
  deleteSensorDataWithinTimeRange,
};
