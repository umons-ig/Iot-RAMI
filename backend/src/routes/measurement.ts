import express from "express";
import {
  createMeasurement,
  createMeasurements,
  deleteMeasurement,
  getMeasurement,
  updateMeasurement,
} from "@controllers/measurement";
import { auth } from "@middlewares/auth";

const router = express.Router();

router
  .get("/:id?", auth, getMeasurement)
  .post("/", auth, createMeasurement)
  .post("/bulk", auth, createMeasurements)
  .put("/:id", auth, updateMeasurement)
  .delete("/:id", auth, deleteMeasurement);

export { router as measurementRoutes };
