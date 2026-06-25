import http from "http";

// Observabilité du nœud fog (cf. PLAN_AMELIORATIONS §3.1). Le fog n'avait
// aucune métrique exposée alors que ce sont les signaux critiques d'un nœud
// edge médical : lag store-and-forward, état Kafka, drops buffer.
// Exposé en format Prometheus texte via le module http natif (zéro dépendance).

export interface FogMetrics {
  outboxPending: number;
  kafkaConnected: boolean;
  drops: number;
  bufferSize: number;
}

/** Sérialise un instantané au format d'exposition Prometheus 0.0.4 (fonction pure). */
export const formatMetrics = (m: FogMetrics): string =>
  [
    "# HELP fog_outbox_pending Événements en attente de réplication vers Kafka (-1 = outbox indisponible)",
    "# TYPE fog_outbox_pending gauge",
    `fog_outbox_pending ${m.outboxPending}`,
    "# HELP fog_kafka_connected État du producteur Kafka (1=connecté, 0=déconnecté)",
    "# TYPE fog_kafka_connected gauge",
    `fog_kafka_connected ${m.kafkaConnected ? 1 : 0}`,
    "# HELP fog_buffer_drops_total Messages droppés cumulés (buffer mémoire plein)",
    "# TYPE fog_buffer_drops_total counter",
    `fog_buffer_drops_total ${m.drops}`,
    "# HELP fog_buffer_size Messages actuellement bufferisés en mémoire",
    "# TYPE fog_buffer_size gauge",
    `fog_buffer_size ${m.bufferSize}`,
    "",
  ].join("\n");

/** Démarre un petit serveur HTTP exposant /metrics et /health. */
export const startMetricsServer = (
  port: number,
  provider: () => Promise<FogMetrics>
): http.Server => {
  const server = http.createServer((req, res) => {
    if (req.url === "/metrics") {
      provider()
        .then((m) => {
          res.writeHead(200, {
            "Content-Type": "text/plain; version=0.0.4",
          });
          res.end(formatMetrics(m));
        })
        .catch((error) => {
          res.writeHead(500);
          res.end(`# metrics error: ${error}`);
        });
      return;
    }
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, () => {
    console.log(`📊 [FogService] Métriques exposées sur :${port}/metrics`);
  });
  return server;
};
