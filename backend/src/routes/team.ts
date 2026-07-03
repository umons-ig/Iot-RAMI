import express from "express";
import {
  createTeam,
  getTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
} from "@controllers/team";
import { auth, authAdmin } from "@middlewares/auth";

const router = express.Router();

router.get("/", auth, getTeams);
router.post("/", authAdmin, createTeam);

router.get("/:id", auth, getTeam);
router.put("/:id", authAdmin, updateTeam);
router.delete("/:id", authAdmin, deleteTeam);

router.post("/:id/members", authAdmin, addMember);
router.delete("/:id/members/:userId", authAdmin, removeMember);

export { router as teamRoutes };
