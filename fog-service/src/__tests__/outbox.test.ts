// --- Mock pg.Pool ---
const poolQuery = jest.fn();
const poolEnd = jest.fn().mockResolvedValue(undefined);
const poolOn = jest.fn();

jest.mock("pg", () => ({
  Pool: jest.fn(() => ({
    query: poolQuery,
    end: poolEnd,
    on: poolOn,
  })),
}));

import { Outbox } from "../outbox";

describe("Outbox", () => {
  let outbox: Outbox;

  beforeEach(() => {
    jest.clearAllMocks();
    poolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    outbox = new Outbox();
  });

  describe("init", () => {
    it("crée la table et l'index partiel", async () => {
      await outbox.init();
      expect(poolQuery).toHaveBeenCalledTimes(2);
      const createTableSql = poolQuery.mock.calls[0][0] as string;
      const createIndexSql = poolQuery.mock.calls[1][0] as string;
      expect(createTableSql).toContain("CREATE TABLE IF NOT EXISTS outbox");
      expect(createTableSql).toContain("payload JSONB NOT NULL");
      expect(createIndexSql).toContain("CREATE INDEX IF NOT EXISTS idx_outbox_pending");
      expect(createIndexSql).toContain("WHERE status = 'pending'");
    });
  });

  describe("enqueue", () => {
    it("INSERT avec sensor_topic et payload JSON", async () => {
      const event = { type: "data", sensorTopic: "capteur-A/sensor", measures: [{ v: 1 }] };
      await outbox.enqueue(event);
      expect(poolQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO outbox"),
        ["capteur-A/sensor", JSON.stringify(event)]
      );
    });

    it("propage l'erreur en cas d'échec d'INSERT", async () => {
      poolQuery.mockRejectedValueOnce(new Error("DB down"));
      await expect(
        outbox.enqueue({ type: "start", sensorTopic: "capteur-A/sensor" })
      ).rejects.toThrow("DB down");
    });
  });

  describe("pullPending", () => {
    it("SELECT les lignes pending par id croissant avec LIMIT", async () => {
      poolQuery.mockResolvedValueOnce({
        rows: [
          { id: "1", payload: { type: "data", sensorTopic: "capteur-A/sensor" } },
          { id: 2, payload: { type: "stop", sensorTopic: "capteur-A/sensor" } },
        ],
      });
      const result = await outbox.pullPending(200);
      expect(poolQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'pending' ORDER BY id ASC LIMIT $1"),
        [200]
      );
      expect(result).toEqual([
        { id: 1, payload: { type: "data", sensorTopic: "capteur-A/sensor" } },
        { id: 2, payload: { type: "stop", sensorTopic: "capteur-A/sensor" } },
      ]);
    });
  });

  describe("markSynced", () => {
    it("UPDATE status='synced' pour les ids fournis", async () => {
      await outbox.markSynced([1, 2, 3]);
      expect(poolQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE outbox SET status = 'synced'"),
        [[1, 2, 3]]
      );
      const sql = poolQuery.mock.calls[0][0] as string;
      expect(sql).toContain("WHERE id = ANY($1)");
    });

    it("ne fait aucune requête si la liste d'ids est vide", async () => {
      await outbox.markSynced([]);
      expect(poolQuery).not.toHaveBeenCalled();
    });
  });

  describe("purgeSynced", () => {
    it("DELETE les lignes synced plus vieilles que retentionDays", async () => {
      poolQuery.mockResolvedValueOnce({ rowCount: 42 });
      const count = await outbox.purgeSynced(7);
      expect(poolQuery).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM outbox WHERE status = 'synced'"),
        [7]
      );
      const sql = poolQuery.mock.calls[0][0] as string;
      expect(sql).toContain("($1 || ' days')::interval");
      expect(count).toBe(42);
    });
  });

  describe("pendingCount", () => {
    it("retourne le nombre de lignes pending", async () => {
      poolQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] });
      const count = await outbox.pendingCount();
      expect(count).toBe(5);
    });
  });

  describe("close", () => {
    it("ferme le pool", async () => {
      await outbox.close();
      expect(poolEnd).toHaveBeenCalled();
    });
  });
});
