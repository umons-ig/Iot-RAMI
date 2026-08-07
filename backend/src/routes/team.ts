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
import { authAdmin } from "@middlewares/auth";

const router = express.Router();

// Lecture réservée aux admins, comme l'écriture juste en dessous : `GET /:id`
// renvoie nom + email de tous les membres, soit l'annuaire complet des
// utilisateurs pour qui énumérait d'abord `GET /`. La vue Teams du frontend est
// déjà admin-only (router/index.ts), donc aucun usage légitime n'est perdu.
router.get("/", authAdmin, getTeams);
router.post("/", authAdmin, createTeam);

router.get("/:id", authAdmin, getTeam);
router.put("/:id", authAdmin, updateTeam);
router.delete("/:id", authAdmin, deleteTeam);

router.post("/:id/members", authAdmin, addMember);
router.delete("/:id/members/:userId", authAdmin, removeMember);

export { router as teamRoutes };
