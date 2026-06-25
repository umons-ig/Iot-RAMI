import fs from "fs";
import path from "path";
import * as dlq from "@service/dlqService";

// La DLQ écrit dans <cwd>/dlq.json (NDJSON). Les tests s'exécutent en série
// (jest --runInBand) : pas de course inter-fichiers.
const DLQ_PATH = path.resolve(process.cwd(), "dlq.json");

const cleanup = () => {
  if (fs.existsSync(DLQ_PATH)) fs.rmSync(DLQ_PATH);
};

describe("dlqService", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("persiste les messages en NDJSON et les compte", () => {
    dlq.push({ type: "data", value: 1 });
    dlq.push({ type: "data", value: 2 });

    expect(dlq.count()).toBe(2);
    const lines = fs.readFileSync(DLQ_PATH, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({ value: 1 });
    expect(JSON.parse(lines[0])._dlqTimestamp).toBeDefined();
  });

  it("flush retraite et vide les messages traités avec succès", async () => {
    dlq.push({ type: "data", value: 1 });
    dlq.push({ type: "data", value: 2 });

    const handler = jest.fn().mockResolvedValue(undefined);
    await dlq.flush(handler);

    expect(handler).toHaveBeenCalledTimes(2);
    // Le _dlqTimestamp interne ne doit pas être passé au handler.
    expect(handler).toHaveBeenCalledWith(
      expect.not.objectContaining({ _dlqTimestamp: expect.anything() })
    );
    expect(dlq.count()).toBe(0);
  });

  it("flush conserve les messages qui échouent au retraitement", async () => {
    dlq.push({ type: "data", value: 1 });
    dlq.push({ type: "data", value: 2 });

    const handler = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("DB down"));
    await dlq.flush(handler);

    // 1 ok, 1 échec -> il en reste 1.
    expect(dlq.count()).toBe(1);
  });

  it("bufferise les push survenus pendant un flush et les réinjecte ensuite", async () => {
    dlq.push({ type: "data", value: 1 });

    let pushedDuring = false;
    await dlq.flush(async () => {
      if (!pushedDuring) {
        pushedDuring = true;
        dlq.push({ type: "data", value: 99 }); // arrive pendant le flush
      }
    });

    // value:1 traité avec succès (retiré) ; value:99 bufferisé puis réappendu.
    expect(dlq.count()).toBe(1);
    const remaining = JSON.parse(fs.readFileSync(DLQ_PATH, "utf-8").trim());
    expect(remaining).toMatchObject({ value: 99 });
  });

  it("ignore les lignes corrompues à la lecture", () => {
    fs.writeFileSync(
      DLQ_PATH,
      '{"value":1}\nligne-corrompue\n{"value":2}\n',
      "utf-8"
    );
    expect(dlq.count()).toBe(2);
  });
});
