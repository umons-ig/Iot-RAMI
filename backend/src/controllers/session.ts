import { Request, Response } from "express";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServerErrorException,
} from "@utils/exceptions";
import {
  deleteSensorDataWithinTimeRange,
  getSensorDataWithinTimeRange,
  getDownsampledSensorData,
} from "@controllers/sensorData";

// Model import
import { Op, QueryTypes } from "sequelize";
import { Role, UserPayload } from "#/user";
import {
  getAccessibleSensorIds,
  userHasSensorAccess,
} from "@service/sensorAccess";
import db from "@db/index";
const DB: any = db;
const { Sensor, Session, sequelize } = DB;
// --- end of model import

/** ============================ PLEASE READ THIS PART IN ORDER TO UNDERSTAND THE SESSION MODEL MANAGEMENT ============================
The session model represents the interval of use of a sensor between t1 and t2 by a person. A session is valid
ON THE SERVER SIDE only if the user started it and then stopped it ON THE BROWSER SIDE. And this is where we can write it into the database.
So, as long as the session is not stopped on the browser side, it is not saved in DB

So, DO NOT CONFUSE the createSessionOnClientSide and createSessionOnServerSide functions
-  1) createSessionOnClientSide:
Opens a session on the client side with mqtt over wesocket and we ask the sensor to send data. It also gives the topic so that the client
can subscribe to it on the browser side.
- 2) createSessionOnServerSide:
Here, we ask the sensor to stop sending values and we validate the session after the user has closed it on the browser side, see above!!!!
*/

// -------------------------------------------- CHECK AND UTILITY FONCTIONS --------------------------------------------

const isUuid = (uuid: string) => {
  const uuidRegex = new RegExp(
    "^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$",
    "i"
  );
  return uuidRegex.test(uuid);
};

const handleDealingWithSensorDataError = (res: Response, error: unknown) => {
  if (error instanceof BadRequestException) {
    return res
      .status(400)
      .json({ error: error.message, code: error.codeError });
  } else if (error instanceof ServerErrorException) {
    return res
      .status(500)
      .json({ error: error.message, code: error.codeError });
  } else {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ----------------------------------------- CONTROLLER FUNCTIONS ---------------------------------------------

// revue
const createSessionOnClientSide = async (req: Request, res: Response) => {
  const { idSensor } = req.body;

  if (!isUuid(idSensor)) {
    return res
      .status(400)
      .json(
        new BadRequestException("sensor id is not uuid", "sensor.id.not.uuid")
      );
  }

  try {
    const sensor = await Sensor.findByPk(idSensor);
    if (!sensor) {
      return res
        .status(404)
        .json(new NotFoundException("Sensor not found", "sensor.not.found"));
    }

    // La réponse divulgue le topic MQTT du capteur — la clé d'entrée pour
    // écouter son flux ou lui pousser des commandes. Sans ce contrôle, tout
    // compte authentifié pouvait l'obtenir pour un capteur quelconque et
    // ouvrir une session dessus.
    const user = req.user as UserPayload | undefined;
    if (
      user?.role !== Role.ADMIN &&
      !(await userHasSensorAccess(user?.userId ?? "", idSensor))
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

    const topicForHearingFromSensor = sensor.topic;

    const session = await Session.create({
      idSensor,
      createdAt: new Date(),
      endedAt: null,
    });
    return res.status(201).json({
      topic: topicForHearingFromSensor,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("❌ [createSessionOnClientSide]", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const createSessionOnServerSide = async (req: Request, res: Response) => {
  const { idSession } = req.body;

  if (!isUuid(idSession)) {
    return res
      .status(400)
      .json(
        new BadRequestException("session id is not uuid", "session.id.not.uuid")
      );
  }

  try {
    // Sans ce contrôle, n'importe quel compte authentifié pouvait clore la
    // session de mesure d'un autre patient en devinant/énumérant son id.
    const session = await Session.findByPk(idSession);
    if (!session) {
      return res
        .status(404)
        .json(new NotFoundException("Session not found", "session.not.found"));
    }

    const user = req.user as UserPayload | undefined;
    const idSensor = session.dataValues?.idSensor ?? session.idSensor;
    if (
      user?.role !== Role.ADMIN &&
      !(await userHasSensorAccess(user?.userId ?? "", idSensor))
    ) {
      return res
        .status(403)
        .json(
          new ForbiddenException(
            "You do not have access to this session",
            "session.access.forbidden"
          )
        );
    }

    await Session.update({ endedAt: new Date() }, { where: { id: idSession } });
    return res.status(201).json({ message: "session ended" });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Restreint une clause `where` de Session aux capteurs accessibles à
// l'utilisateur (sauf admin qui voit tout). Renvoie null si pas de filtre.
const sessionAccessWhere = async (
  req: Request
): Promise<Record<string, unknown> | null> => {
  const user = req.user as UserPayload | undefined;
  if (user?.role === Role.ADMIN) return null;
  const accessibleSensorIds = await getAccessibleSensorIds(user?.userId ?? "");
  return { idSensor: { [Op.in]: accessibleSensorIds } };
};

// Get all sessions
const getAllSessions = async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit as string) || 20)
  );
  const offset = (page - 1) * limit;
  try {
    const accessWhere = await sessionAccessWhere(req);
    const { count, rows } = await Session.findAndCountAll({
      ...(accessWhere ? { where: accessWhere } : {}),
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

// Get all active sessions
const getAllActiveSessions = async (req: Request, res: Response) => {
  try {
    const accessWhere = await sessionAccessWhere(req);
    const sessions = await Session.findAll({
      where: {
        endedAt: null, // Assuming that an active session has a null endedAt
        ...(accessWhere ?? {}),
      },
    });
    return res.status(200).json(sessions);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get session by ID
const getSessionById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    // Let's find out the session
    const session = await Session.findByPk(id);

    if (!session) {
      return res
        .status(404)
        .json(new NotFoundException("Session not found", "session.not.found"));
    }

    return res.status(200).json(session);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete session
const deleteSessionAndItsCorrespondingData = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id;
    // Let's find out the session
    const session = await Session.findByPk(id);

    if (!session) {
      return res
        .status(404)
        .json(new NotFoundException("Session not found", "session.not.found"));
    }

    const sensor = await Sensor.findByPk(session.idSensor);
    if (!sensor) {
      return res
        .status(404)
        .json(new NotFoundException("Sensor not found", "sensor.not.found"));
    }

    // Bornes de la session OBLIGATOIRES : appelée avec le seul idSensor, la
    // fonction supprime TOUT l'historique du capteur (`buildSensorDataWhereClause`
    // n'ajoute aucun filtre temporel sans time1/time2). Supprimer une session
    // d'une heure effaçait donc des mois de données médicales, sans avertissement.
    const startedAt = new Date(
      session.dataValues?.createdAt ?? session.createdAt
    );
    const endedAt = new Date(
      session.dataValues?.endedAt ?? session.endedAt ?? new Date()
    );

    // Fenêtre vide (session ouverte et refermée dans le même instant) : il n'y a
    // rien à supprimer. On le dit explicitement plutôt que de laisser la
    // validation temporelle répondre 400, qui laisserait croire à une requête
    // malformée.
    const deletedRowsNumber =
      endedAt.getTime() > startedAt.getTime()
        ? await deleteSensorDataWithinTimeRange(
            session.idSensor,
            startedAt,
            endedAt
          )
        : 0;

    //await session.destroy();
    return res.status(200).json({ deletedRowsNumber: deletedRowsNumber });
  } catch (error) {
    return handleDealingWithSensorDataError(res, error);
  }
};

const deleteAllSessions = async (_: Request, res: Response) => {
  try {
    await Session.destroy({ where: {} });
    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getSessionData = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Let's find out the session
    const session = await Session.findByPk(id);

    if (!session) {
      return res
        .status(404)
        .json(new NotFoundException("Session not found", "session.not.found"));
    }

    // Vérifier que le capteur existe
    const sensor = await Sensor.findByPk(session.idSensor);
    if (!sensor) {
      return res
        .status(404)
        .json(new NotFoundException("Sensor not found", "sensor.not.found"));
    }

    const startTime = session.dataValues.createdAt;
    const endTime = session.dataValues.endedAt ?? new Date();

    // `maxPoints` alimente le sous-échantillonnage : non plafonné, il servait à
    // contourner la limite de 10 000 points de la branche sans downsampling.
    const MAX_POINTS = 10_000;
    const maxPointsParam = req.query.maxPoints;
    const parsedMaxPoints = maxPointsParam
      ? parseInt(maxPointsParam as string, 10)
      : 0;
    const maxPoints =
      Number.isFinite(parsedMaxPoints) && parsedMaxPoints > 0
        ? Math.min(parsedMaxPoints, MAX_POINTS)
        : 0;

    const sensorData =
      maxPoints > 0
        ? await getDownsampledSensorData(
            sensor.dataValues.id,
            startTime,
            endTime,
            maxPoints
          )
        : await getSensorDataWithinTimeRange(
            sensor.dataValues.id,
            startTime,
            endTime,
            10_000
          );

    return res.status(200).json(sensorData);
  } catch (error) {
    return handleDealingWithSensorDataError(res, error);
  }
};

// Prevents CSV injection: values starting with formula chars are prefixed with a single quote
const sanitizeCsvField = (value: string): string => {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
};

const exportSessionAsCsv = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const session = await Session.findByPk(id);
    if (!session) {
      return res
        .status(404)
        .json(new NotFoundException("Session not found", "session.not.found"));
    }
    const sensor = await Sensor.findByPk(session.idSensor);
    if (!sensor) {
      return res
        .status(404)
        .json(new NotFoundException("Sensor not found", "sensor.not.found"));
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="session-${id}.csv"`
    );

    // En-tête écrit immédiatement, puis les données par LOTS.
    // L'ancienne version matérialisait toute la session en mémoire trois fois
    // (lignes SQL, tableau de chaînes, puis `join`) : sur une session ECG longue
    // — plusieurs centaines de milliers de points — le processus Node saturait
    // la mémoire du Raspberry Pi, et n'importe quel utilisateur authentifié
    // pouvait déclencher ce déni de service en boucle.
    res.write(
      [
        `# session_id,${session.dataValues.id}`,
        `# sensor_id,${sensor.dataValues.id}`,
        `# sensor_name,${sanitizeCsvField(sensor.dataValues.name)}`,
        `# sensor_topic,${sanitizeCsvField(sensor.dataValues.topic)}`,
        `# start_time,${new Date(session.dataValues.createdAt).toISOString()}`,
        `# end_time,${
          session.dataValues.endedAt
            ? new Date(session.dataValues.endedAt).toISOString()
            : ""
        }`,
        `time,value,type`,
        "",
      ].join("\n")
    );

    const CSV_BATCH_SIZE = 10_000;
    const endedAt = session.dataValues.endedAt ?? new Date();
    let offset = 0;
    // Le client peut couper à tout moment ; sans ce drapeau, la boucle
    // continuait d'interroger la base et d'attendre un `drain` qui ne viendrait
    // jamais, retenant la connexion et le lot en mémoire indéfiniment.
    let aborted = false;
    const onClose = () => {
      aborted = true;
    };
    res.on("close", onClose);

    try {
      while (!aborted) {
        const batch = await getSensorDataWithinTimeRange(
          sensor.dataValues.id,
          session.dataValues.createdAt,
          endedAt,
          CSV_BATCH_SIZE,
          offset
        );
        if (!batch || batch.length === 0) break;

        const chunk = batch
          .map(
            (row: any) =>
              `${new Date(row.time).toISOString()},${sanitizeCsvField(
                String(row.value)
              )},${sanitizeCsvField(row.MeasurementType.name)}`
          )
          .join("\n");

        // `write` renvoie false quand le tampon est plein : on attend le drain
        // pour ne pas accumuler côté serveur si le client télécharge lentement.
        // On attend AUSSI `close`, sinon une déconnexion pendant l'attente
        // laisserait cette promesse pendante pour toujours.
        if (!res.write(chunk + "\n")) {
          await new Promise<void>((resolve) => {
            const done = () => {
              res.off("drain", done);
              res.off("close", done);
              resolve();
            };
            res.once("drain", done);
            res.once("close", done);
          });
        }

        if (batch.length < CSV_BATCH_SIZE) break;
        offset += CSV_BATCH_SIZE;
      }
    } catch (streamError) {
      // Les en-têtes sont déjà partis : impossible de renvoyer un JSON d'erreur
      // ici — `res.status().json()` lèverait ERR_HTTP_HEADERS_SENT, et le rejet
      // remonterait en exception non capturée, ce qui tue le process (donc
      // toutes les sessions ECG en cours). On coupe la réponse : le client verra
      // un téléchargement tronqué, ce qui est le seul signal possible à ce stade.
      console.error("[exportSessionAsCsv] échec en cours de flux:", streamError);
      res.destroy();
      return;
    } finally {
      res.off("close", onClose);
    }

    if (aborted) return;
    return res.end();
  } catch (error) {
    return handleDealingWithSensorDataError(res, error);
  }
};
const getSessionAggregate = async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const session = await Session.findByPk(id);
    if (!session) {
      return res
        .status(404)
        .json(new NotFoundException("Session not found", "session.not.found"));
    }
    const sensor = await Sensor.findByPk(session.idSensor);
    if (!sensor) {
      return res
        .status(404)
        .json(new NotFoundException("Sensor not found", "sensor.not.found"));
    }
    const rows = await sequelize.query(
      `SELECT bucket, avg_value, min_value, max_value, count, "idMeasurementType"
     FROM sensordata_1min
     WHERE "idSensor" = :idSensor
       AND bucket >= :start
       AND bucket <= :end
     ORDER BY bucket ASC`,
      {
        replacements: {
          idSensor: sensor.dataValues.id,
          start: new Date(session.dataValues.createdAt).toISOString(),
          end: new Date(session.dataValues.endedAt ?? new Date()).toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    );
    return res.status(200).json(rows);
  } catch (error) {
    return handleDealingWithSensorDataError(res, error);
  }
};

export {
  createSessionOnClientSide,
  createSessionOnServerSide,
  getAllSessions,
  getSessionById,
  getSessionData,
  exportSessionAsCsv,
  deleteSessionAndItsCorrespondingData,
  deleteAllSessions,
  getAllActiveSessions,
  getSessionAggregate,
};
