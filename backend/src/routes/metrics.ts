import express, { Request, Response } from "express";
import { metricsRegistry } from "@middlewares/metrics";

const router = express.Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const metrics = await metricsRegistry.metrics();
    res.set("Content-Type", metricsRegistry.contentType);
    res.end(metrics);
  } catch (err) {
    res.status(500).end(String(err));
  }
});

export { router as metricsRoutes };
