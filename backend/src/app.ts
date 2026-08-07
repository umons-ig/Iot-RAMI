import "dotenv/config";
import express, { Express } from "express";
import swaggerUi from "swagger-ui-express";
import cookieparser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import { openApiDocumentation } from "@docs/index";

import { routes } from "@routes/routes";
import { NotFoundException } from "@utils/exceptions";
import {
  globalLimiter,
  authLimiter,
  loginLimiter,
  signupLimiter,
} from "@middlewares/rateLimiter";
import { metricsMiddleware } from "@middlewares/metrics";
import { metricsRoutes } from "@routes/metrics";
import { errorHandler } from "@middlewares/errorHandler";
import { envs } from "@utils/env";

const app: Express = express();

app.use(globalLimiter);
// `authLimiter` doit couvrir TOUTES les surfaces d'authentification. Monté sur
// le seul préfixe /auth, il laissait /users/login et /users/signup (où vivent
// réellement le login et l'inscription) sous le seul globalLimiter, soit 500
// tentatives de mot de passe par tranche de 5 min.
app.use("/api/v1/auth", authLimiter);
app.use("/api/v1/users/login", loginLimiter);
app.use("/api/v1/users/signup", signupLimiter);
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

/**
 * `/metrics` n'est destiné qu'au Prometheus du réseau Docker.
 *
 * Deux défauts de l'ancien filtre (`ip === "127.0.0.1" || ip.startsWith("172.")`) :
 *  - trop large : 172.0.0.0/8 contient des adresses PUBLIQUES routables, alors
 *    que les réseaux Docker vivent dans 172.16.0.0/12 ;
 *  - trop étroit : en IPv4-mapped (`::ffff:127.0.0.1`), la loopback était
 *    refusée — vérifié en local, l'appel renvoyait 403.
 *
 * On s'en tient STRICTEMENT à la loopback et au bridge Docker. Surtout pas à
 * tout le RFC 1918 : le backend est publié sur le LAN de l'université, donc
 * autoriser 10/8 et 192.168/16 ouvrirait les métriques (activité patients en
 * temps réel, cartographie des routes) à n'importe quel poste du campus.
 */
const isAllowedMetricsIp = (rawIp: string): boolean => {
  const ip = rawIp.replace(/^::ffff:/, "");
  if (ip === "::1") return true;

  const octets = ip.split(".");
  if (octets.length !== 4) return false;
  if (!octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255)) {
    return false;
  }
  const [a, b] = octets.map(Number);

  if (a === 127) return true; // loopback
  if (a === 172 && b >= 16 && b <= 31) return true; // bridge Docker (172.16.0.0/12)
  return false;
};

app.use(
  "/metrics",
  (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "";
    if (!isAllowedMetricsIp(ip)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  },
  metricsRoutes
);

for (const route of routes) {
  app.use(baseUri + route.path, route.handler);
}

// Swagger n'est PAS servi en production : vérifié en conditions réelles, il
// répondait 200 sans authentification et livrait le schéma complet de l'API
// (endpoints, paramètres, modèles) — une carte prête à l'emploi pour cibler les
// autres appels. Il reste disponible en développement, où il est utile.
// Pour le rouvrir sur une instance de démonstration : SWAGGER_ENABLED=true.
if (envs.NODE_ENV !== "production" || process.env.SWAGGER_ENABLED === "true") {
  app.use(
    "/api/v1/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocumentation)
  );
}

app.all("*", (_req, res) => {
  return res
    .status(404)
    .json(new NotFoundException("Resource not found", "resource.not.found"));
});

// Filet de sécurité global : doit être enregistré en dernier (cf. §2.4).
app.use(errorHandler);

export default app;
