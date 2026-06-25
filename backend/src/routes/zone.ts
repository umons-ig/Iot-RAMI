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

export { router as zoneRoutes };
