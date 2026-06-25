import { Request, Response } from "express";
// Model(s) import
import db from "@db/index";
const DB: any = db;
const { Team, TeamMember, User, Zone } = DB;
// --- End of model(s) import
import { BadRequestException, NotFoundException } from "@utils/exceptions";

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
  console.error(`Error ${action} team:`, error);
  return res
    .status(500)
    .json({ error: "Internal server error.", code: "team.internal.error" });
};

const createTeam = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new BadRequestException("name is required", "team.name.required");
    }
    const team = await Team.create({ name: name.trim() });
    return res.status(201).json(team);
  } catch (error) {
    return handleError(res, error, "creating");
  }
};

const getTeams = async (_req: Request, res: Response) => {
  try {
    const teams = await Team.findAll({ order: [["name", "ASC"]] });
    return res.status(200).json(teams);
  } catch (error) {
    return handleError(res, error, "listing");
  }
};

const getTeam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const team = await Team.findByPk(id, {
      include: [
        {
          model: User,
          as: "members",
          attributes: ["id", "firstName", "lastName", "email"],
          through: { attributes: [] },
        },
        {
          model: Zone,
          as: "zones",
          attributes: ["id", "name", "type"],
          through: { attributes: [] },
        },
      ],
    });
    if (!team) throw new NotFoundException("Team not found", "team.not.found");
    return res.status(200).json(team);
  } catch (error) {
    return handleError(res, error, "fetching");
  }
};

const updateTeam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const team = await Team.findByPk(id);
    if (!team) throw new NotFoundException("Team not found", "team.not.found");
    if (name !== undefined) {
      if (!name || String(name).trim() === "") {
        throw new BadRequestException("name is required", "team.name.required");
      }
      team.set("name", String(name).trim());
    }
    await team.save();
    return res.status(200).json(team);
  } catch (error) {
    return handleError(res, error, "updating");
  }
};

const deleteTeam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const team = await Team.findByPk(id);
    if (!team) throw new NotFoundException("Team not found", "team.not.found");
    // Les FK ON DELETE CASCADE retirent membres et grants de zone.
    await team.destroy();
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error, "deleting");
  }
};

const addMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // teamId
    const { userId } = req.body;
    if (!userId) {
      throw new BadRequestException(
        "userId is required",
        "team.member.required"
      );
    }
    const [team, user] = await Promise.all([
      Team.findByPk(id),
      User.findByPk(userId),
    ]);
    if (!team) throw new NotFoundException("Team not found", "team.not.found");
    if (!user) throw new NotFoundException("User not found", "user.not.found");

    const [member] = await TeamMember.findOrCreate({
      where: { teamId: id, userId },
      defaults: { teamId: id, userId },
    });
    return res.status(201).json(member);
  } catch (error) {
    return handleError(res, error, "adding member to");
  }
};

const removeMember = async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params; // teamId, userId
    const deleted = await TeamMember.destroy({ where: { teamId: id, userId } });
    if (deleted === 0) {
      throw new NotFoundException(
        "Membership not found",
        "team.member.not.found"
      );
    }
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error, "removing member from");
  }
};

export {
  createTeam,
  getTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
};
