import express from "express";
import {
  createMeasurementType,
  deleteMeasurementType,
  getMeasurementType,
  updateMeasurementType,
  getDiscoveredMeasurementTypes,
} from "@controllers/measurementType";
import { auth, authAdmin } from "@middlewares/auth";

const router = express.Router();

router.get("/discovered", authAdmin, getDiscoveredMeasurementTypes);

router
  .route("/:id?")
  .post(authAdmin, createMeasurementType)
  .get(auth, getMeasurementType)
  .put(authAdmin, updateMeasurementType)
  .delete(authAdmin, deleteMeasurementType);

export { router as measurementTypeRoutes };
