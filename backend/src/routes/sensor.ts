import express from "express";
import {
  createSensor,
  deleteSensor,
  getSensor,
  updateSensor,
  getSensorSessions,
  getSensorTopic,
  getDiscoveredSensors,
  getSensorStatus,
  getAllSensorsStatus,
} from "@controllers/sensor";
import { auth, authAdmin } from "@middlewares/auth";

const router = express.Router();

// Must be before /:id? to avoid being caught as an id param
router.get("/discovered", authAdmin, getDiscoveredSensors);
router.get("/connexion/online", auth, getAllSensorsStatus);
router.get("/connexion/online/:sensorName", auth, getSensorStatus);

router
  .route("/:id?")
  .post(authAdmin, createSensor)
  .get(auth, getSensor)
  .put(authAdmin, updateSensor)
  .delete(authAdmin, deleteSensor);
// Depend at least on two models
router.get("/:id/sessions", auth, getSensorSessions);
router.get("/:id/topic", auth, getSensorTopic);

export { router as sensorRoutes };
