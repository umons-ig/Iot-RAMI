import express from "express";
import {
  createThreshold,
  deleteThreshold,
  getThresholdBySensor,
  updateThreshold,
} from "@controllers/threshold";
import { auth } from "@middlewares/auth";

const router = express.Router();

router
  .route("/:id?")
  .post(auth, createThreshold)
  .put(auth, updateThreshold)
  .delete(auth, deleteThreshold);
router.get("/sensor/:idSensor", auth, getThresholdBySensor);

export { router as thresholdRoutes };
