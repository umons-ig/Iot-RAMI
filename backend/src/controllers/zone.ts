import { Request, Response } from "express";
// Model(s) import
import db from "@db/index";
const DB: any = db;
const { Zone, Sensor } = DB;
// --- End of model(s) import
import { BadRequestException, NotFoundException } from "@utils/exceptions";
import { Role, UserPayload } from "#/user";
import { getSensorsAvailable } from "@controllers/measurement";

/**
 * Renvoie la liste des IDs de capteurs visibles par l'utilisateur courant.
 * `null` => admin (aucun filtre, voit tout). Sinon => liste blanche d'IDs
 * (cohérent avec le filtrage de GET /sensors).
 */
const accessibleSensorIds = async (req: Request): Promise<string[] | null> => {
  const token = req.user as UserPayload;
  if (token.role === Role.ADMIN) return null;
  return getSensorsAvailable(token);
};

interface ZoneRow {
  id: string;
  name: string;
  type: string | null;
  parentId: string | null;
}

/**
 * Construit l'arbre imbriqué à partir de la liste plate des zones.
 * Une seule requête DB + reconstruction O(n) en mémoire (suffisant pour
 * un parc de quelques centaines de zones).
 */
const buildTree = (zones: ZoneRow[], sensorCounts: Record<string, number>) => {
  const byId = new Map<string, any>();
  zones.forEach((z) => {
    byId.set(z.id, {
      id: z.id,
      name: z.name,
      type: z.type,
      parentId: z.parentId,
      sensorCount: sensorCounts[z.id] ?? 0,
      children: [],
    });
  });

  const roots: any[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

const createZone = async (req: Request, res: Response) => {
  try {
    const { name, type, parentId } = req.body;
    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new BadRequestException("name is required", "zone.name.required");
    }
    if (parentId) {
      const parent = await Zone.findByPk(parentId);
      if (!parent) {
        throw new BadRequestException(
          "parentId does not reference an existing zone",
          "zone.parent.invalid"
        );
      }
    }
    const zone = await Zone.create({
      name: name.trim(),
      type: type ?? null,
      parentId: parentId ?? null,
    });
    return res.status(201).json(zone);
  } catch (error) {
    return handleError(res, error, "creating");
  }
};

const getZones = async (_req: Request, res: Response) => {
  try {
    const zones = await Zone.findAll({ order: [["name", "ASC"]] });
    return res.status(200).json(zones);
  } catch (error) {
    return handleError(res, error, "listing");
  }
};

const getZoneTree = async (req: Request, res: Response) => {
  try {
    const zones: ZoneRow[] = await Zone.findAll({
      attributes: ["id", "name", "type", "parentId"],
      raw: true,
    });
    // Compte des capteurs directs par zone, restreint aux capteurs visibles
    // par l'utilisateur (un non-admin ne doit pas déduire l'existence de
    // capteurs auxquels il n'a pas accès via le compteur).
    const allowedIds = await accessibleSensorIds(req);
    const sensorWhere =
      allowedIds === null
        ? { zoneId: { [DB.Sequelize.Op.ne]: null } }
        : {
            zoneId: { [DB.Sequelize.Op.ne]: null },
            id: { [DB.Sequelize.Op.in]: allowedIds },
          };
    const sensors = await Sensor.findAll({
      attributes: ["zoneId"],
      where: sensorWhere,
      raw: true,
    });
    const counts: Record<string, number> = {};
    sensors.forEach((s: { zoneId: string }) => {
      counts[s.zoneId] = (counts[s.zoneId] ?? 0) + 1;
    });

    return res.status(200).json(buildTree(zones, counts));
  } catch (error) {
    return handleError(res, error, "building tree of");
  }
};

const getZone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allowedIds = await accessibleSensorIds(req);
    // Non-admin : on restreint les capteurs inclus à ceux autorisés (LEFT JOIN
    // via required:false pour ne pas masquer la zone si aucun capteur visible).
    const sensorInclude =
      allowedIds === null
        ? { model: Sensor }
        : {
            model: Sensor,
            required: false,
            where: { id: { [DB.Sequelize.Op.in]: allowedIds } },
          };
    const zone = await Zone.findByPk(id, {
      include: [{ model: Zone, as: "children" }, sensorInclude],
    });
    if (!zone) {
      throw new NotFoundException("Zone not found", "zone.not.found");
    }
    return res.status(200).json(zone);
  } catch (error) {
    return handleError(res, error, "fetching");
  }
};

const getZoneSensors = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findByPk(id);
    if (!zone) {
      throw new NotFoundException("Zone not found", "zone.not.found");
    }
    const allowedIds = await accessibleSensorIds(req);
    // Même filtrage d'accès que GET /sensors : un non-admin ne voit que les
    // capteurs auxquels il a accès, jamais tout le contenu de la zone.
    const where =
      allowedIds === null
        ? { zoneId: id }
        : { zoneId: id, id: { [DB.Sequelize.Op.in]: allowedIds } };
    const sensors = await Sensor.findAll({
      where,
      order: [["name", "ASC"]],
    });
    return res.status(200).json(sensors);
  } catch (error) {
    return handleError(res, error, "fetching sensors of");
  }
};

/**
 * Empêche les cycles : interdit de rattacher une zone sous elle-même ou
 * sous l'un de ses descendants (sinon l'arbre boucle à l'infini).
 */
const wouldCreateCycle = async (
  zoneId: string,
  newParentId: string
): Promise<boolean> => {
  if (zoneId === newParentId) return true;
  let cursor: string | null = newParentId;
  // Remonte de newParent jusqu'à la racine ; si on retombe sur zoneId => cycle.
  while (cursor) {
    if (cursor === zoneId) return true;
    const parent: { parentId: string | null } | null = await Zone.findByPk(
      cursor,
      { attributes: ["parentId"], raw: true }
    );
    cursor = parent ? parent.parentId : null;
  }
  return false;
};

const updateZone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, parentId } = req.body;
    const zone = await Zone.findByPk(id);
    if (!zone) {
      throw new NotFoundException("Zone not found", "zone.not.found");
    }

    if (parentId !== undefined && parentId !== null) {
      const parent = await Zone.findByPk(parentId);
      if (!parent) {
        throw new BadRequestException(
          "parentId does not reference an existing zone",
          "zone.parent.invalid"
        );
      }
      if (await wouldCreateCycle(id, parentId)) {
        throw new BadRequestException(
          "A zone cannot be moved under itself or one of its descendants",
          "zone.parent.cycle"
        );
      }
    }

    if (name !== undefined) zone.set("name", String(name).trim());
    if (type !== undefined) zone.set("type", type);
    if (parentId !== undefined) zone.set("parentId", parentId);
    await zone.save();

    return res.status(200).json(zone);
  } catch (error) {
    return handleError(res, error, "updating");
  }
};

const deleteZone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cascade = req.query.cascade === "true";
    const zone = await Zone.findByPk(id);
    if (!zone) {
      throw new NotFoundException("Zone not found", "zone.not.found");
    }

    if (!cascade) {
      const childCount = await Zone.count({ where: { parentId: id } });
      const sensorCount = await Sensor.count({ where: { zoneId: id } });
      if (childCount > 0 || sensorCount > 0) {
        throw new BadRequestException(
          `Zone is not empty (${childCount} sous-zone(s), ${sensorCount} capteur(s)). Use ?cascade=true to force.`,
          "zone.not.empty"
        );
      }
    }

    // ?cascade=true => la FK ON DELETE CASCADE supprime le sous-arbre,
    // ON DELETE SET NULL déclasse les capteurs concernés.
    await zone.destroy();
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error, "deleting");
  }
};

/** Rattache (ou détache si zoneId=null) un capteur à une zone. */
const assignSensor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // zoneId (ou "none" pour détacher)
    const { sensorId } = req.body;
    if (!sensorId) {
      throw new BadRequestException(
        "sensorId is required",
        "zone.sensor.required"
      );
    }
    const sensor = await Sensor.findByPk(sensorId);
    if (!sensor) {
      throw new NotFoundException("Sensor not found", "sensor.not.found");
    }

    if (id === "none") {
      sensor.set("zoneId", null);
    } else {
      const zone = await Zone.findByPk(id);
      if (!zone) {
        throw new NotFoundException("Zone not found", "zone.not.found");
      }
      sensor.set("zoneId", id);
    }
    await sensor.save();
    return res.status(200).json(sensor);
  } catch (error) {
    return handleError(res, error, "assigning sensor to");
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleError = (res: Response, error: any, action: string) => {
  if (error instanceof BadRequestException) {
    return res
      .status(400)
      .json({ error: error.message, code: error.codeError });
  }
  if (error instanceof NotFoundException) {
    return res
      .status(404)
      .json({ error: error.message, code: error.codeError });
  }
  console.error(`Error ${action} zone:`, error);
  return res.status(500).json({
    error: "Internal server error.",
    code: "zone.internal.error",
  });
};

export {
  createZone,
  getZones,
  getZoneTree,
  getZone,
  getZoneSensors,
  updateZone,
  deleteZone,
  assignSensor,
};
