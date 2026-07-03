import express from "express";
import {
  createZone,
  getZones,
  getZoneTree,
  getZone,
  getZoneSensors,
  updateZone,
  deleteZone,
  assignSensor,
  getZoneAccess,
  grantZoneAccess,
  revokeZoneAccess,
} from "@controllers/zone";
import { auth, authAdmin } from "@middlewares/auth";

const router = express.Router();

// Doit passer avant /:id pour ne pas être capturé comme un id.
router.get("/tree", auth, getZoneTree);

router.get("/", auth, getZones);
router.post("/", authAdmin, createZone);

router.get("/:id", auth, getZone);
router.put("/:id", authAdmin, updateZone);
router.delete("/:id", authAdmin, deleteZone);

router.get("/:id/sensors", auth, getZoneSensors);
// :id = zoneId, ou "none" pour détacher un capteur de toute zone.
router.put("/:id/sensors", authAdmin, assignSensor);

// Accès à une zone (users + teams) — accordé en cascade sur le sous-arbre.
router.get("/:id/access", authAdmin, getZoneAccess);
router.post("/:id/access", authAdmin, grantZoneAccess);
router.delete("/:id/access", authAdmin, revokeZoneAccess);

export { router as zoneRoutes };
