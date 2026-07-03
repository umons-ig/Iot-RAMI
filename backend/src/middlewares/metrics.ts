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

const normalizeRoute = (path: string): string => {
  return path.replace(/\/\d+/g, "/:id");
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
