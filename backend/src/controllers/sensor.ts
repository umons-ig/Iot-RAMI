import { Request, Response } from "express";
// Model(s) import
import db from "@db/index";
const DB: any = db;
const { Sensor, Session } = DB;
// --- End of model(s) import
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServerErrorException,
} from "@utils/exceptions";
import { Role, UserPayload } from "#/user";
import { getSensorsAvailable } from "@controllers/measurement";
import {
  getAccessibleSensorIds,
  userHasSensorAccess,
} from "@service/sensorAccess";
import { Op } from "sequelize";
import { discoveredTopics } from "@service/discorverdSensorSevice";

const checkName = (name: string) => {
  if (!name) {
    throw new BadRequestException("Name is required", "sensor.name.required");
  }

  if (name.length > 255) {
    throw new BadRequestException("Name is too long", "sensor.name.too.long");
  }
  if (name.length < 3) {
    throw new BadRequestException("Name is too short", "sensor.name.too.short");
  }
};

const checkTopic = (topic: string) => {
  if (!topic) {
    throw new BadRequestException("Topic is required", "topic.name.required");
  }

  if (topic.length > 255) {
    throw new BadRequestException("Topic is too long", "topic.name.too.long");
  }
  if (topic.length < 3) {
    throw new BadRequestException("Topic is too short", "topic.name.too.short");
  }
};

const checkId = (id: string) => {
  if (!id) {
    throw new BadRequestException("Id is required", "sensor.id.required");
  }

  if (id.length !== 36) {
    throw new BadRequestException(
      "Id must be a valid uuid",
      "sensor.id.not.uuid"
    );
  }
};

const checkIfNameExists = async (name: string) => {
  try {
    const sensor = await Sensor.findOne({ where: { name } });
    if (sensor) {
      throw new BadRequestException(
        "Sensor already exists",
        "sensor.already.exists"
      );
    }
  } catch (error) {
    throw error instanceof BadRequestException
      ? error
      : new ServerErrorException("Server error", "server.error");
  }
};

const checkIfTopicExists = async (topic: string) => {
  try {
    const sensor = await Sensor.findOne({ where: { topic } });
    if (sensor) {
      throw new BadRequestException(
        "Topic already exists",
        "topic.already.exists"
      );
    }
  } catch (error) {
    throw error instanceof BadRequestException
      ? error
      : new ServerErrorException("Server error", "server.error");
  }
};

const createSensor = async (req: Request, res: Response) => {
  const { name, topic } = req.body;
  try {
    checkName(name);
    checkTopic(topic);
  } catch (error) {
    return res.status(400).json(error);
  }
  try {
    await checkIfNameExists(name);
    await checkIfTopicExists(topic);
  } catch (error) {
    return error instanceof BadRequestException
      ? res.status(400).json(error)
      : res
          .status(500)
          .json(new ServerErrorException("Server error", "server.error"));
  }

  try {
    const sensor = await Sensor.create({ name, topic });
    if (!sensor) {
      return res
        .status(500)
        .json(new ServerErrorException("Server error", "server.error"));
    }
    discoveredTopics.delete(topic);
    return res.status(201).json(sensor);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const getAllSensorsStatus = async (req: Request, res: Response) => {
  try {
    // Restreint l'inventaire aux capteurs accessibles. Sans ce filtre, tout
    // compte authentifié obtenait la liste exhaustive de la flotte ET, via le
    // statut "publishing", quels patients sont sous surveillance à l'instant t.
    // C'est aussi le point de départ commode pour cibler les autres endpoints :
    // le nom de capteur suffit à dériver le topic.
    const user = req.user as UserPayload | undefined;
    const isAdmin = user?.role === Role.ADMIN;
    const accessibleIds = isAdmin
      ? null
      : await getAccessibleSensorIds(user?.userId ?? "");

    const sensors = await Sensor.findAll({
      attributes: ["id", "name"],
      ...(accessibleIds ? { where: { id: { [Op.in]: accessibleIds } } } : {}),
    });
    const activeSessions = await Session.findAll({
      where: { endedAt: null },
      attributes: ["idSensor"],
    });
    const publishingIds = new Set(
      activeSessions.map((s: any) => s.dataValues.idSensor)
    );
    const statuses: Record<string, string> = {};
    for (const sensor of sensors) {
      statuses[sensor.dataValues.name] = publishingIds.has(sensor.dataValues.id)
        ? "publishing"
        : "offline";
    }
    return res.status(200).json(statuses);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const getSensorStatus = async (req: Request, res: Response) => {
  const { sensorName } = req.params;
  try {
    const sensor = await Sensor.findOne({ where: { name: sensorName } });
    if (!sensor) {
      return res
        .status(400)
        .json(
          new BadRequestException("Invalid sensor name", "sensor.name.invalid")
        );
    }

    // Pendant unitaire du filtrage appliqué à `getAllSensorsStatus` : sans lui,
    // il suffisait d'interroger un capteur par son nom pour savoir s'il est en
    // train de publier — donc si un patient est sous surveillance à cet instant.
    const user = req.user as UserPayload | undefined;
    if (
      user?.role !== Role.ADMIN &&
      !(await userHasSensorAccess(user?.userId ?? "", sensor.dataValues.id))
    ) {
      return res
        .status(403)
        .json(
          new ForbiddenException(
            "You do not have access to this sensor",
            "sensor.access.forbidden"
          )
        );
    }
    const activeSession = await Session.findOne({
      where: { idSensor: sensor.dataValues.id, endedAt: null },
    });
    return res
      .status(200)
      .json({ message: activeSession ? "publishing" : "offline" });
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const getDiscoveredSensors = async (_: Request, res: Response) => {
  try {
    return res.status(200).json(Array.from(discoveredTopics.values()));
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getSensor = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.query;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit as string) || 20)
  );
  const offset = (page - 1) * limit;
  let nameString = "";
  if (name) {
    nameString = name.toString();
  }

  const decodedToken = req.user as UserPayload;
  let isAdmin = false;
  let sensorsAvailableId: string[] = [];
  let sensorsAvailableName: string[] = [];

  try {
    isAdmin = decodedToken.role === Role.ADMIN;
    sensorsAvailableId = isAdmin ? [] : await getSensorsAvailable(decodedToken);
    sensorsAvailableName = isAdmin
      ? []
      : await getSensorsAvailable(decodedToken, true);
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
  if (!isAdmin && sensorsAvailableId.length === 0) {
    return res
      .status(403)
      .json(
        new NotFoundException(
          "You don't have access to any sensor",
          "sensor.not.found"
        )
      );
  }

  if (!isAdmin && id && !sensorsAvailableId.includes(id)) {
    return res
      .status(403)
      .json(
        new NotFoundException(
          "You don't have access to this sensor",
          "sensor.not.found"
        )
      );
  }

  if (
    !isAdmin &&
    nameString !== "" &&
    !sensorsAvailableName.includes(nameString)
  ) {
    return res
      .status(403)
      .json(
        new NotFoundException(
          "You don't have access to this sensor",
          "sensor.not.found"
        )
      );
  }

  try {
    // find one if there is an id or findAll if there is no id
    if (id) {
      const sensor = await Sensor.findByPk(id);
      if (!sensor)
        return res
          .status(404)
          .json(new NotFoundException("Sensor not found", "sensor.not.found"));
      return res.status(200).json(sensor);
    }
    if (nameString !== "") {
      const sensor = await Sensor.findOne({ where: { name: nameString } });
      if (!sensor)
        return res
          .status(404)
          .json(new NotFoundException("Sensor not found", "sensor.not.found"));
      return res.status(200).json(sensor);
    }
    const where = isAdmin ? {} : { id: sensorsAvailableId };
    const { count, rows } = await Sensor.findAndCountAll({
      where,
      limit,
      offset,
    });
    if (!rows)
      return res
        .status(404)
        .json(new NotFoundException("Sensor not found", "sensor.not.found"));
    return res.status(200).json({
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const updateSensor = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, topic } = req.body;
  try {
    checkName(name);
    checkTopic(topic);
    checkId(id);
  } catch (error) {
    return res.status(400).json(error);
  }

  const decodedToken = req.user as UserPayload;
  let isAdmin = false;
  let sensorsAvailableId: string[] = [];

  try {
    isAdmin = decodedToken.role === Role.ADMIN;
    sensorsAvailableId = isAdmin ? [] : await getSensorsAvailable(decodedToken);
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

  if (!isAdmin && sensorsAvailableId.length === 0) {
    return res
      .status(403)
      .json(
        new NotFoundException(
          "You don't have access to any sensor",
          "sensor.not.found"
        )
      );
  }

  if (!isAdmin && id && !sensorsAvailableId.includes(id)) {
    return res
      .status(403)
      .json(
        new NotFoundException(
          "You don't have access to this sensor",
          "sensor.not.found"
        )
      );
  }

  try {
    const sensor = await Sensor.update({ name, topic }, { where: { id } });
    if (!sensor) {
      return res
        .status(400)
        .json(new NotFoundException("Sensor not found", "sensor.not.found"));
    }
    return res.status(200).json(sensor);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const deleteSensor = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    checkId(id);
  } catch (error) {
    return res.status(400).json(error);
  }

  const decodedToken = req.user as UserPayload;
  let isAdmin = false;
  let sensorsAvailableId: string[] = [];

  try {
    isAdmin = decodedToken.role === Role.ADMIN;
    sensorsAvailableId = isAdmin ? [] : await getSensorsAvailable(decodedToken);
  } catch (e) {
    switch (true) {
      case e instanceof BadRequestException:
        return res.status(400).json(e);
      case e instanceof NotFoundException:
        return res.status(404).json(e);
      default:
        return res.status(500).json(e);
    }
  }

  if (!isAdmin && sensorsAvailableId.length === 0) {
    return res
      .status(403)
      .json(
        new NotFoundException(
          "You don't have access to any sensor",
          "sensor.not.found"
        )
      );
  }

  if (!isAdmin && id && !sensorsAvailableId.includes(id)) {
    return res
      .status(403)
      .json(
        new NotFoundException(
          "You don't have access to this sensor",
          "sensor.not.found"
        )
      );
  }

  try {
    const sensor = await Sensor.destroy({ where: { id } });
    if (!sensor) {
      return res
        .status(400)
        .json(new NotFoundException("Sensor not found", "sensor.not.found"));
    }
    return res.status(200).json({ message: "Sensor deleted" });
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const getSensorSessions = async (req: Request, res: Response) => {
  const { id } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit as string) || 20)
  );
  const offset = (page - 1) * limit;

  try {
    const sensor = await Sensor.findByPk(id);
    if (!sensor) {
      return res
        .status(400)
        .json(new NotFoundException("Sensor not found", "sensor.not.found"));
    }

    const { count, rows } = await Session.findAndCountAll({
      where: { idSensor: sensor.id },
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getSensorTopic = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Let's find out the sensoer
    const sensor = await Sensor.findByPk(id);
    if (!sensor) {
      return res
        .status(400)
        .json(new NotFoundException("Sensor not found", "sensor.not.found"));
    }

    const topicFromDB = sensor.topic;
    return res.status(200).json({
      topic: topicFromDB,
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export {
  createSensor,
  getSensor,
  updateSensor,
  deleteSensor,
  checkId,
  checkName,
  checkIfNameExists,
  checkTopic,
  checkIfTopicExists,
  getSensorSessions,
  getSensorTopic,
  getDiscoveredSensors,
  getSensorStatus,
  getAllSensorsStatus,
};
