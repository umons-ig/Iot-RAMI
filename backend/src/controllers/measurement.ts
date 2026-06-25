import { Request, Response } from "express";
// Model(s) import
import db from "@db/index";
const DB: any = db;
const { Measurement, MeasurementType, Sensor, UserSensorAccess } = DB;
// --- End of model(s) import
import {
  BadRequestException,
  MultiStatusException,
  ForbiddenException,
  NotFoundException,
  ServerErrorException,
} from "@utils/exceptions";
import { MeasurementModel } from "#/measurement";
import { Role, UserPayload } from "#/user";
import { FindAttributeOptions, Op, OrderItem } from "sequelize";
import { Status } from "#/sensor";

const formatKey = (format: string, timestamp: Date): string => {
  const getTimePart = (part: string): number => {
    switch (part) {
      case "second":
        return timestamp.getSeconds();
      case "midMinute":
        return Math.floor(timestamp.getSeconds() / 30);
      case "minute":
        return timestamp.getMinutes();
      case "quarterHour":
        return Math.floor(timestamp.getMinutes() / 15);
      case "halfHour":
        return Math.floor(timestamp.getMinutes() / 30);
      case "hour":
        return timestamp.getHours();
      case "day":
        return timestamp.getDate();
      case "week":
        return Math.floor(timestamp.getDate() / 7);
      case "fortnight":
        return Math.floor(timestamp.getDate() / 15);
      case "month":
        return timestamp.getMonth();
      case "quarter":
        return Math.floor(timestamp.getMonth() / 3);
      case "halfYear":
        return Math.floor(timestamp.getMonth() / 6);
      case "year":
        return timestamp.getFullYear();
      case "decade":
        return Math.floor(timestamp.getFullYear() / 10);
      case "century":
        return Math.floor(timestamp.getFullYear() / 100);
      case "millennium":
        return Math.floor(timestamp.getFullYear() / 1000);
      default:
        throw new BadRequestException(
          "Invalid time part: " + part,
          "measurement.sample.invalid.time.part"
        );
    }
  };

  const getTimeParts = (parts: string[]): number[] => parts.map(getTimePart);

  const timeParts = getTimeParts(format.split("-"));
  return timeParts.join("-");
};

const getSample = ({
  result,
  sample,
  average,
}: {
  result: MeasurementModel[];
  sample: string;
  average?: string;
}) => {
  // Create a temporary array and a map to store the sample measurements
  const sampleTmp: MeasurementModel[] = [];
  const sampleMap = new Map();

  // Validate the average flag if provided
  if (average && average.toLowerCase() !== "true") {
    throw new BadRequestException(
      "Measurement average not valid",
      "measurement.average.not.valid"
    );
  }

  // verify if result is one value
  if (!Array.isArray(result)) {
    return result;
  }

  // Iterate through each measurement
  result.forEach((measurement) => {
    let key: string;
    const timestamp = measurement.dataValues.timestamp;
    switch (sample.toLowerCase()) {
      // Determine the key based on the sample time
      case "secondly":
        key = formatKey("second-minute-hour-day-month-year", timestamp);
        break;
      case "midminutely":
        key = formatKey("midMinute-minute-hour-day-month-year", timestamp);
        break;
      case "minutely":
        key = formatKey("minute-hour-day-month-year", timestamp);
        break;
      case "quarterhourly":
        key = formatKey("quarterHour-hour-day-month-year", timestamp);
        break;
      case "halfhourly":
        key = formatKey("halfHour-hour-day-month-year", timestamp);
        break;
      case "hourly":
        key = formatKey("hour-day-month-year", timestamp);
        break;
      case "daily":
        key = formatKey("day-month-year", timestamp);
        break;
      case "weekly":
        key = formatKey("week-month-year", timestamp);
        break;
      case "fortnightly":
        key = formatKey("fortnight-month-year", timestamp);
        break;
      case "monthly":
        key = formatKey("month-year", timestamp);
        break;
      case "quarterly":
        key = formatKey("quarter-year", timestamp);
        break;
      case "halfyearly":
        key = formatKey("halfYear-year", timestamp);
        break;
      case "yearly":
        key = formatKey("year", timestamp);
        break;
      case "decade":
        key = formatKey("decade", timestamp);
        break;
      case "century":
        key = formatKey("century", timestamp);
        break;
      case "millennium":
        key = formatKey("millennium", timestamp);
        break;
      default:
        throw new BadRequestException(
          "Sample time is not valid",
          "measurement.sample.not.valid"
        );
    }

    // If the sample map does not have the key, add the measurement to the sample
    if (!sampleMap.has(key)) {
      sampleMap.set(key, measurement);
      sampleTmp.push(measurement);
    } else {
      // If the average flag is enabled, calculate the average value
      if (average) {
        const measurementInMap = sampleMap.get(key);
        measurementInMap.dataValues.value =
          (measurementInMap.dataValues.value + measurement.dataValues.value) /
          2;
      }
    }
  });

  return sampleTmp;
};

/**
 * Capteurs accessibles via les ZONES accordées à l'utilisateur (directement
 * ou via ses teams), en CASCADE sur le sous-arbre : un accès « Bâtiment A »
 * donne accès à tous les capteurs des étages/pièces sous A.
 */
const zoneGrantedSensorIds = async (userId: string): Promise<string[]> => {
  // 1. Zones accordées directement à l'utilisateur.
  const userGrants = await DB.UserZoneAccess.findAll({
    attributes: ["zoneId"],
    where: { userId },
    raw: true,
  });
  // 2. Zones accordées aux teams dont l'utilisateur est membre.
  const memberships = await DB.TeamMember.findAll({
    attributes: ["teamId"],
    where: { userId },
    raw: true,
  });
  const teamIds = memberships.map((m: any) => m.teamId);
  let teamGrants: any[] = [];
  if (teamIds.length > 0) {
    teamGrants = await DB.TeamZoneAccess.findAll({
      attributes: ["zoneId"],
      where: { teamId: { [Op.in]: teamIds } },
      raw: true,
    });
  }

  const grantedZoneIds = new Set<string>([
    ...userGrants.map((g: any) => g.zoneId),
    ...teamGrants.map((g: any) => g.zoneId),
  ]);
  if (grantedZoneIds.size === 0) return [];

  // 3. Expansion au sous-arbre : on construit la table parent -> enfants
  //    puis on descend depuis chaque zone accordée (cascade).
  const allZones = await DB.Zone.findAll({
    attributes: ["id", "parentId"],
    raw: true,
  });
  const childrenMap = new Map<string, string[]>();
  allZones.forEach((z: any) => {
    if (z.parentId) {
      const arr = childrenMap.get(z.parentId) ?? [];
      arr.push(z.id);
      childrenMap.set(z.parentId, arr);
    }
  });
  const expanded = new Set<string>();
  const stack = [...grantedZoneIds];
  while (stack.length) {
    const zid = stack.pop();
    if (!zid || expanded.has(zid)) continue;
    expanded.add(zid);
    for (const c of childrenMap.get(zid) ?? []) stack.push(c);
  }

  // 4. Capteurs rattachés à l'une de ces zones.
  const sensors = await DB.Sensor.findAll({
    attributes: ["id"],
    where: { zoneId: { [Op.in]: Array.from(expanded) } },
    raw: true,
  });
  return sensors.map((s: any) => s.id);
};

const getSensorsAvailable = async (decodedToken: UserPayload, name = false) => {
  const result = await UserSensorAccess.findAll({
    where: {
      userId: decodedToken.userId,
      status: Status.ACCEPTED,
    },
  });

  // Accès = capteurs accordés individuellement ∪ capteurs des zones accordées
  // (à l'utilisateur ou à ses teams), en cascade.
  const individualIds = (result ?? []).map(
    (sensor: any) => sensor.dataValues.sensorId
  );
  const zoneIds = await zoneGrantedSensorIds(decodedToken.userId);
  const allIds = Array.from(new Set([...individualIds, ...zoneIds]));

  if (!name) {
    return allIds;
  }

  const sensorNames = await Sensor.findAll({
    attributes: ["name"],
    where: { id: allIds },
  });

  return sensorNames.map((sensorName: any) => sensorName.dataValues.name);
};

const getMeasurement = async (req: Request, res: Response) => {
  const { number, date, type, sensor, sample, average } = req.query;
  const { id } = req.params;

  const decodedToken = req.user as UserPayload;
  let isAdmin = false;
  let sensors: string[] = [];

  try {
    isAdmin = decodedToken.role === Role.ADMIN;
    sensors = isAdmin ? [] : await getSensorsAvailable(decodedToken, true);
  } catch (e) {
    switch (true) {
      case e instanceof BadRequestException:
        return res.status(400).json(e);
      case e instanceof NotFoundException:
        return res.status(404).json(e);
      default:
        return res
          .status(500)
          .json(new ServerErrorException("Server error", "server.error"));
    }
  }

  const includeOptions = [];
  if (type && typeof type === "string") {
    includeOptions.push({
      model: MeasurementType,
      attributes: ["name"],
      as: "measurementType",
      where: {
        name: type,
      },
    });
  } else {
    includeOptions.push({
      model: MeasurementType,
      attributes: ["name"],
      as: "measurementType",
    });
  }

  if (sensor && typeof sensor === "string" && !isAdmin) {
    if (sensors.length > 0 && !sensors.includes(sensor)) {
      return res
        .status(403)
        .json(
          new BadRequestException(
            "You are not allowed to access this sensor",
            "measurement.sensor.not.allowed"
          )
        );
    }
    includeOptions.push({
      model: Sensor,
      as: "sensor",
      attributes: ["name"],
      where: {
        name: sensor,
      },
    });
  } else if (isAdmin) {
    includeOptions.push({
      model: Sensor,
      attributes: ["name"],
      as: "sensor",
    });
  } else {
    includeOptions.push({
      model: Sensor,
      attributes: ["name"],
      as: "sensor",
      where: {
        name: {
          [Op.in]: sensors,
        },
      },
    });
  }

  const whereOptions = [];
  if (id) {
    whereOptions.push({
      id: id,
    });
  }

  if (date && typeof date === "string") {
    try {
      const dateObject = checkDate(date);
      whereOptions.push({
        date: dateObject,
      });
    } catch (error) {
      return res.status(400).json(error);
    }
  }

  let numberInt = -1;
  if (number && typeof number === "string") {
    numberInt = parseInt(number);
    if (isNaN(numberInt)) {
      return res
        .status(400)
        .json(
          new BadRequestException(
            "Number is not valid",
            "measurement.number.not.valid"
          )
        );
    }
  }

  const orderOptions = [
    ["timestamp", "DESC"],
    ["idSensor", "ASC"],
    ["idMeasurementType", "ASC"],
  ] as OrderItem[];

  const attributesOptions = ["timestamp", "value"] as FindAttributeOptions;

  try {
    const result =
      numberInt > 0
        ? await Measurement.findAll({
            include: includeOptions,
            attributes: attributesOptions,
            where: whereOptions,
            limit: numberInt,
            order: orderOptions,
          })
        : await Measurement.findAll({
            include: includeOptions,
            where: whereOptions,
            attributes: attributesOptions,
            order: orderOptions,
          });

    if (result.length === 0) {
      return res
        .status(404)
        .json(
          new NotFoundException(
            "Measurement not found",
            "measurement.not.found"
          )
        );
    }

    if (!sample && !average) {
      return res.status(200).json(result);
    }
    if (!sample && average) {
      return res
        .status(400)
        .json(
          new BadRequestException(
            "Sample time is required",
            "measurement.sample.time.required"
          )
        );
    }
    if (typeof sample !== "string") {
      return res
        .status(400)
        .json(
          new BadRequestException(
            "Sample time is not valid",
            "measurement.sample.time.not.valid"
          )
        );
    }
    if (average && typeof average !== "string") {
      return res
        .status(400)
        .json(
          new BadRequestException(
            "Average is not valid",
            "measurement.average.not.valid"
          )
        );
    }
    if (average) {
      const sampleTmp = getSample({ result, sample, average });
      return res.status(200).json(sampleTmp);
    }
    const sampleTmp = getSample({ result, sample });
    return res.status(200).json(sampleTmp);
  } catch (error) {
    switch (true) {
      case error instanceof BadRequestException:
        return res.status(400).json(error);
      case error instanceof ServerErrorException:
        return res.status(500).json(error);
      default:
        return res
          .status(500)
          .json(new ServerErrorException("Server error", "server.error"));
    }
  }
};

const checkDate = (date: string) => {
  if (!date) {
    throw new BadRequestException(
      "Date is required",
      "measurement.date.required"
    );
  }
  const dateObject = new Date(date);
  if (new Date(date).toString() === "Invalid Date") {
    throw new BadRequestException(
      "Date is not valid",
      "measurement.date.not.valid"
    );
  }
  return dateObject;
};

const checkValue = (value: string) => {
  if (!value) {
    throw new BadRequestException(
      "Value is required",
      "measurement.value.required"
    );
  }
  if (isNaN(parseInt(value))) {
    throw new BadRequestException(
      "Value is invalid",
      "measurement.value.not.valid"
    );
  }
  return parseInt(value);
};

const isUuid = (uuid: string) => {
  const uuidRegex = new RegExp(
    "^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$",
    "i"
  );
  return uuidRegex.test(uuid);
};

const checkType = async (type: string) => {
  if (!type) {
    throw new BadRequestException(
      "Type is required",
      "measurement.measurementType.required"
    );
  }

  try {
    const result = await MeasurementType.findOne({
      where: {
        name: type,
      },
      attributes: ["id"],
    });
    if (!result) {
      throw new NotFoundException(
        "Measurement type not found",
        "measurement.measurementType.not.found"
      );
    }
    return result.dataValues.id;
  } catch (error) {
    switch (true) {
      case error instanceof NotFoundException:
        throw error;
      default:
        throw new ServerErrorException("Server error", "server.error");
    }
  }
};

const checkSensor = async (sensor: string) => {
  if (!sensor) {
    throw new BadRequestException(
      "Sensor is required",
      "measurement.sensor.required"
    );
  }
  try {
    const result = await Sensor.findOne({
      where: {
        name: sensor,
      },
      attributes: ["id"],
    });
    if (!result) {
      throw new NotFoundException(
        "Sensor not found",
        "measurement.sensor.not.found"
      );
    }
    return result.dataValues.id;
  } catch (error) {
    switch (true) {
      case error instanceof NotFoundException:
        throw error;
      default:
        throw new ServerErrorException("Server error", "server.error");
    }
  }
};

const createMeasurements = async (req: Request, res: Response) => {
  const measurementsInit = req.body;
  if (!measurementsInit || measurementsInit.length === 0) {
    return res
      .status(400)
      .json(
        new BadRequestException(
          "Measurements are required",
          "measurement.measurements.required"
        )
      );
  }
  if (!Array.isArray(measurementsInit)) {
    return res
      .status(400)
      .json(
        new BadRequestException(
          "Measurements must be an array",
          "measurement.measurements.not.array"
        )
      );
  }
  if (measurementsInit.length > 1000) {
    return res
      .status(400)
      .json(
        new BadRequestException(
          "Maximum number of measurements is 1000",
          "measurement.measurements.max"
        )
      );
  }

  interface info {
    index: number[];
    id: string;
    name: string;
  }

  let errors = "";

  try {
    // Check if all measurements are valid and transform them to the database model, for performance reasons we will check all types and all sensors in one query
    let sensorsInfo: info[] = [];
    let typesInfo: info[] = [];
    const dates: Date[] = [];
    const values: number[] = [];
    let index = 0;
    for (const measurement of measurementsInit) {
      const { date, value, type, sensor } = measurement;
      let dateObject: Date;
      let valueNumber: number;
      try {
        dateObject = checkDate(date);
        dates.push(dateObject);
      } catch (error) {
        // it can only be a BadRequestException
        errors += " on measurement " + index + "; ";
      }
      try {
        valueNumber = checkValue(value);
        values.push(valueNumber);
      } catch (error) {
        // it can only be a BadRequestException
        errors += "Server error on measurement " + index + "; ";
      }

      if (typesInfo.findIndex((info) => info.name === type) === -1) {
        typesInfo.push({ index: [index], id: "", name: type });
      } else {
        typesInfo[typesInfo.findIndex((info) => info.name === type)].index.push(
          index
        );
      }
      if (sensorsInfo.findIndex((info) => info.name === sensor) === -1) {
        sensorsInfo.push({ index: [index], id: "", name: sensor });
      } else {
        sensorsInfo[
          sensorsInfo.findIndex((info) => info.name === sensor)
        ].index.push(index);
      }
      index++;
    }

    // feed measurements array with dates and values and let idSensor and idMeasurementType empty
    let measurements = dates.map((date, index) => {
      return {
        timestamp: date,
        value: values[index],
        idSensor: "",
        idMeasurementType: "",
      };
    });

    // Check if all types are valid
    const types = await MeasurementType.findAll({
      where: {
        name: typesInfo.map((info) => info.name),
      },
      attributes: ["id", "name"],
    });
    if (types.length !== typesInfo.length) {
      const notFoundTypes = typesInfo.filter(
        (info) => !types.find((type: any) => type.dataValues.name === info.name)
      );
      errors +=
        "Types not found: " +
        notFoundTypes.map((info) => info.name).join(", ") +
        " on measurements: " +
        notFoundTypes.map((info) => info.index).join(", ") +
        "; ";
      // delete types not found from typesInfo
      typesInfo = typesInfo.filter(
        (info) => !notFoundTypes.find((type) => type.name === info.name)
      );
    }
    for (const type of types) {
      typesInfo[
        typesInfo.findIndex((info) => info.name === type.dataValues.name)
      ].id = type.dataValues.id;
    }

    // add types to measurements
    for (const type of typesInfo) {
      for (const index of type.index) {
        measurements[index].idMeasurementType = type.id;
      }
    }

    // Check if all sensors are valid
    const sensors = await Sensor.findAll({
      where: {
        name: sensorsInfo.map((info) => info.name),
      },
      attributes: ["id", "name"],
    });
    if (sensors.length !== sensorsInfo.length) {
      const notFoundSensors = sensorsInfo.filter(
        (info) =>
          !sensors.find((sensor: any) => sensor.dataValues.name === info.name)
      );
      errors +=
        "Sensors not found: " +
        notFoundSensors.map((info) => info.name).join(", ") +
        " on measurements: " +
        notFoundSensors.map((info) => info.index).join(", ") +
        "; ";

      sensorsInfo = sensorsInfo.filter(
        (info) => !notFoundSensors.find((sensor) => sensor.name === info.name)
      );
    }

    for (const sensor of sensors) {
      sensorsInfo[
        sensorsInfo.findIndex((info) => info.name === sensor.dataValues.name)
      ].id = sensor.dataValues.id;
    }

    // add sensors to measurements
    for (const sensor of sensorsInfo) {
      for (const index of sensor.index) {
        measurements[index].idSensor = sensor.id;
      }
    }

    measurements = measurements.filter(
      (measurement) =>
        measurement.idSensor !== "" && measurement.idMeasurementType !== ""
    );

    const results = await Measurement.bulkCreate(measurements);
    if (results.length === measurementsInit.length) {
      return res.status(201).json(results);
    } else if (results.length === 0) {
      return res
        .status(500)
        .json(new ServerErrorException("Server error", "server.error"));
    } else {
      if (typeof results.length !== "undefined") {
        errors +=
          "Some measurements were created, but not all of them. Created: " +
          results.length +
          " of " +
          measurementsInit.length +
          "; ";
      }
      return res
        .status(207)
        .json(new MultiStatusException(errors, "server.error"));
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};
const createMeasurement = async (req: Request, res: Response) => {
  const { date, value, type, sensor } = req.body;
  let dateObject: Date;
  let valueNumber: number;
  let typeId: string;
  let sensorId: string;
  try {
    dateObject = checkDate(date);
    valueNumber = checkValue(value);
    typeId = await checkType(type);
    sensorId = await checkSensor(sensor);
  } catch (error) {
    switch (true) {
      case error instanceof BadRequestException:
        return res.status(400).json(error);
      case error instanceof NotFoundException:
        return res.status(404).json(error);
      default:
        return res.status(500).json(error);
    }
  }

  const decodedToken = req.user as UserPayload;
  let isAdmin = false;
  let sensorsAvailable: string[] = [];

  try {
    isAdmin = decodedToken.role === Role.ADMIN;
    sensorsAvailable = isAdmin ? [] : await getSensorsAvailable(decodedToken);
  } catch (e) {
    switch (true) {
      case e instanceof BadRequestException:
        return res.status(400).json(e);
      case e instanceof NotFoundException:
        return res.status(404).json(e);
      default:
        return res
          .status(500)
          .json(new ServerErrorException("Server error", "server.error"));
    }
  }

  if (!sensorsAvailable.includes(sensorId) && !isAdmin) {
    return res
      .status(403)
      .json(
        new ForbiddenException(
          "You don't have access to this sensor",
          "measurement.sensor.forbidden"
        )
      );
  }

  try {
    const result = await Measurement.create({
      timestamp: dateObject,
      value: valueNumber,
      idMeasurementType: typeId,
      idSensor: sensorId,
    });
    if (!result) {
      return res
        .status(500)
        .json(new ServerErrorException("Server error", "server.error"));
    }
    return res.status(201).json(result);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const updateMeasurement = async (req: Request, res: Response) => {
  const { date, type, sensor, value } = req.body;
  const { id } = req.params;

  let dateObject: Date;
  let typeId: string;
  let sensorId: string;
  let valueInt: number;
  try {
    dateObject = checkDate(date);
    valueInt = checkValue(value);
    typeId = await checkType(type);
    sensorId = await checkSensor(sensor);
  } catch (error) {
    switch (true) {
      case error instanceof BadRequestException:
        return res.status(400).json(error);
      case error instanceof NotFoundException:
        return res.status(404).json(error);
      default:
        return res
          .status(500)
          .json(new ServerErrorException("Server error", "server.error"));
    }
  }

  const decodedToken = req.user as UserPayload;
  let isAdmin = false;
  let sensorsAvailable: string[] = [];

  try {
    isAdmin = decodedToken.role === Role.ADMIN;
    sensorsAvailable = isAdmin ? [] : await getSensorsAvailable(decodedToken);
  } catch (e) {
    switch (true) {
      case e instanceof BadRequestException:
        return res.status(400).json(e);
      case e instanceof NotFoundException:
        return res.status(404).json(e);
      default:
        return res
          .status(500)
          .json(new ServerErrorException("Server error", "server.error"));
    }
  }

  if (!sensorsAvailable.includes(sensorId) && !isAdmin) {
    return res
      .status(403)
      .json(
        new ForbiddenException(
          "You don't have access to this sensor",
          "measurement.sensor.forbidden"
        )
      );
  }

  try {
    const result = await Measurement.update(
      {
        value: valueInt,
      },
      {
        where: {
          id: id,
          timestamp: dateObject,
          idMeasurementType: typeId,
          idSensor: sensorId,
        },
      }
    );
    if (!result) {
      return res
        .status(404)
        .json(
          new NotFoundException(
            "Measurement not found",
            "measurement.not.found"
          )
        );
    }
    return res.status(200).json(result);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const deleteMeasurement = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res
      .status(400)
      .json(
        new BadRequestException("Id is not valid", "measurement.id.not.uuid")
      );
  }

  const decodedToken = req.user as UserPayload;
  let isAdmin = false;
  let sensorsAvailable: string[] = [];

  try {
    isAdmin = decodedToken.role === Role.ADMIN;
    sensorsAvailable = isAdmin ? [] : await getSensorsAvailable(decodedToken);
  } catch (e) {
    switch (true) {
      case e instanceof BadRequestException:
        return res.status(400).json(e);
      case e instanceof NotFoundException:
        return res.status(404).json(e);
      default:
        return res
          .status(500)
          .json(new ServerErrorException("Server error", "server.error"));
    }
  }

  if (!sensorsAvailable.includes(id) && !isAdmin) {
    return res
      .status(403)
      .json(
        new ForbiddenException(
          "You don't have access to this sensor",
          "measurement.sensor.forbidden"
        )
      );
  }

  try {
    const result = await Measurement.destroy({
      where: {
        id: id,
      },
    });

    if (!result) {
      return res
        .status(404)
        .json(
          new NotFoundException(
            "Measurement not found",
            "measurement.not.found"
          )
        );
    }
    return res.status(200).json(result);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

export {
  getMeasurement,
  createMeasurements,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
  checkDate,
  checkValue,
  checkType,
  checkSensor,
  getSample,
  formatKey,
  getSensorsAvailable,
};
