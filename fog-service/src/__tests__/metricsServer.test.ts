import { formatMetrics, FogMetrics } from "../metricsServer";

describe("formatMetrics", () => {
  const snapshot: FogMetrics = {
    outboxPending: 42,
    kafkaConnected: true,
    drops: 7,
    bufferSize: 13,
  };

  it("expose les 4 métriques au format Prometheus", () => {
    const out = formatMetrics(snapshot);
    expect(out).toContain("fog_outbox_pending 42");
    expect(out).toContain("fog_kafka_connected 1");
    expect(out).toContain("fog_buffer_drops_total 7");
    expect(out).toContain("fog_buffer_size 13");
  });

  it("inclut les en-têtes HELP/TYPE de chaque métrique", () => {
    const out = formatMetrics(snapshot);
    expect(out).toContain("# TYPE fog_outbox_pending gauge");
    expect(out).toContain("# TYPE fog_buffer_drops_total counter");
  });

  it("encode kafkaConnected=false en 0", () => {
    const out = formatMetrics({ ...snapshot, kafkaConnected: false });
    expect(out).toContain("fog_kafka_connected 0");
  });
});
