import "dotenv/config";
import express, { Express } from "express";
import swaggerUi from "swagger-ui-express";
import cookieparser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import { openApiDocumentation } from "@docs/index";

import { routes } from "@routes/routes";
import { NotFoundException } from "@utils/exceptions";
import { globalLimiter, authLimiter } from "@middlewares/rateLimiter";
import { metricsMiddleware } from "@middlewares/metrics";
import { metricsRoutes } from "@routes/metrics";
import { errorHandler } from "@middlewares/errorHandler";

const app: Express = express();

app.use(globalLimiter);
app.use("/api/v1/auth", authLimiter);
app.use(metricsMiddleware);
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Accept",
      "Content-Type",
      "Authorization",
    ],
  })
);
app.use(express.json({ limit: "256kb" }));
app.use(
  express.urlencoded({ limit: "256kb", extended: true, parameterLimit: 50000 })
);
app.use(cookieparser());

// Liveness/readiness probe (utilisé par les healthchecks Docker, non authentifié)
app.get("/health", (_req, res) => {
  return res.status(200).json({ status: "ok" });
});

const baseUri = "/api/v1";

app.use(
  "/metrics",
  (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "";
    const allowed =
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip.startsWith("172.") ||
      ip.startsWith("::ffff:172.");
    if (!allowed) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  },
  metricsRoutes
);

for (const route of routes) {
  app.use(baseUri + route.path, route.handler);
}

app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openApiDocumentation));

app.all("*", (_req, res) => {
  return res
    .status(404)
    .json(new NotFoundException("Resource not found", "resource.not.found"));
});

// Filet de sécurité global : doit être enregistré en dernier (cf. §2.4).
app.use(errorHandler);

export default app;
