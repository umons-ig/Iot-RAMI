import { Request, Response, NextFunction } from "express";
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Nombre total de requêtes HTTP reçues",
  labelNames: ["method", "route", "status_code"],
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "Durée des requêtes HTTP en secondes",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const activeSessionsTotal = new Gauge({
  name: "active_sessions_total",
  help: "Nombre de sessions actives en base de données",
  registers: [metricsRegistry],
});

export const kafkaMessageProcessingSeconds = new Histogram({
  name: "kafka_message_processing_seconds",
  help: "Temps de traitement d'un message Kafka (réception → écriture DB)",
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [metricsRegistry],
});

/**
 * Réduit un chemin à sa forme paramétrée pour servir de label Prometheus.
 *
 * Les UUID DOIVENT être normalisés : le projet identifie capteurs, sessions et
 * utilisateurs par UUID, or l'ancienne version ne remplaçait que les segments
 * numériques. Chaque URL produisait donc une série temporelle distincte —
 * cardinalité non bornée, mémoire de Prometheus et du backend qui monte
 * indéfiniment, et n'importe qui pouvait l'accélérer en tapant des URL au hasard.
 */
const UUID_SEGMENT =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Familles de routes réellement montées (cf. `routes/routes.ts`). Tout ce qui
 * n'en fait pas partie est replié sur une étiquette unique.
 *
 * Normaliser les UUID ne suffisait pas : `metricsMiddleware` est monté AVANT le
 * routeur, donc `res.on("finish")` se déclenche aussi sur les 404 de
 * `app.all("*")`. Un chemin arbitraire sans UUID ni chiffre traversait
 * `normalizeRoute` intact et créait un jeu de labels de plus — et `prom-client`
 * ne purge jamais. Boucler sur `GET /<aléatoire>` faisait donc croître la
 * mémoire du backend sans authentification ; le limiteur global cadence cette
 * croissance, il ne la borne pas.
 */
const KNOWN_ROUTE_PREFIXES = new Set([
  "sensors",
  "zones",
  "teams",
  "sessions",
  "measurementTypes",
  "measurements",
  "users",
  "auth",
  "thresholds",
]);

const MAX_LABEL_LENGTH = 120;

const normalizeRoute = (path: string): string => {
  const normalized = path
    .replace(UUID_SEGMENT, "/:id")
    .replace(/\/\d+/g, "/:id");

  if (normalized === "/health" || normalized === "/metrics") return normalized;

  const apiMatch = normalized.match(/^\/api\/v1\/([^/]+)/);
  if (!apiMatch) return "/other";
  if (!KNOWN_ROUTE_PREFIXES.has(apiMatch[1])) return "/api/v1/other";

  // Filet de sécurité : même sous un préfixe connu, un chemin anormalement long
  // ne doit pas devenir un label.
  return normalized.length > MAX_LABEL_LENGTH
    ? `/api/v1/${apiMatch[1]}/other`
    : normalized;
};

export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = process.hrtime();

  res.on("finish", () => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const durationInSeconds = seconds + nanoseconds / 1e9;

    const route = normalizeRoute(req.path);
    const method = req.method;
    const statusCode = String(res.statusCode);

    httpRequestsTotal.labels(method, route, statusCode).inc();
    httpRequestDurationSeconds
      .labels(method, route, statusCode)
      .observe(durationInSeconds);
  });

  next();
};
