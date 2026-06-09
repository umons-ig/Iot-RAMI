import express from "express";
import {
  createSessionOnClientSide,
  createSessionOnServerSide,
  getAllSessions,
  getSessionById,
  getSessionData,
  exportSessionAsCsv,
  deleteSessionAndItsCorrespondingData,
  deleteAllSessions,
  getAllActiveSessions,
  getSessionAggregate,
} from "@controllers/session";
import { auth, authAdmin } from "@middlewares/auth";

const router = express.Router();
// Only depends on session model
router.post("/new", auth, createSessionOnClientSide);
router.post("/new/on/server", auth, createSessionOnServerSide);
router.get("/", auth, getAllSessions);
router.get("/active", auth, getAllActiveSessions);
router.get("/:id", auth, getSessionById);
router.delete("/:id", authAdmin, deleteSessionAndItsCorrespondingData);
router.delete("/", authAdmin, deleteAllSessions);
// Depend at least on two models
router.get("/:id/export/csv", auth, exportSessionAsCsv);
router.get("/:id/data", auth, getSessionData);
router.get("/:id/aggregate", auth, getSessionAggregate);

export { router as sessionRoutes };
