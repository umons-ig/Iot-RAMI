import { Pool } from "pg";
import { PG_CONFIG } from "./constants";

/**
 * Représente un événement à persister dans l'outbox.
 * Forme : { type: "start" | "data" | "stop", sensorTopic, ... }
 */
export interface OutboxEvent {
  type: string;
  sensorTopic: string;
  [key: string]: unknown;
}

/**
 * Ligne `pending` lue depuis l'outbox, prête à être répliquée vers Kafka.
 */
export interface PendingRow {
  id: number;
  payload: OutboxEvent;
}

/**
 * Outbox durable basée sur PostgreSQL local (conteneur).
 *
 * Invariant store-and-forward : toute mesure/événement est d'abord écrit ici
 * (status='pending') avant tout envoi réseau. Un réplicateur externe lit les
 * lignes pending, les publie vers Kafka, puis les marque 'synced'. Rien n'est
 * perdu si Kafka tombe ; reprise automatique au redémarrage.
 */
export class Outbox {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: PG_CONFIG.host,
      port: PG_CONFIG.port,
      user: PG_CONFIG.user,
      password: PG_CONFIG.password,
      database: PG_CONFIG.database,
      max: 5,
    });

    this.pool.on("error", (err) => {
      console.error("❌ [Outbox] Erreur du pool Postgres:", err);
    });
  }

  /**
   * Crée la table et l'index partiel si absents. Idempotent.
   */
  public async init(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS outbox (
          id BIGSERIAL PRIMARY KEY,
          sensor_topic TEXT NOT NULL,
          payload JSONB NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          synced_at TIMESTAMPTZ
        );
      `);
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox (id) WHERE status = 'pending';
      `);
      console.log("✅ [Outbox] Table prête");
    } catch (error) {
      console.error("❌ [Outbox] Erreur init:", error);
      throw error;
    }
  }

  /**
   * Persiste un événement (status='pending'). À appeler AVANT tout ACK capteur.
   */
  public async enqueue(event: OutboxEvent): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO outbox (sensor_topic, payload) VALUES ($1, $2)`,
        [event.sensorTopic, JSON.stringify(event)],
      );
    } catch (error) {
      console.error("❌ [Outbox] Erreur enqueue:", error);
      throw error;
    }
  }

  /**
   * Lit jusqu'à `limit` lignes pending, les plus anciennes d'abord.
   */
  public async pullPending(limit: number): Promise<PendingRow[]> {
    try {
      const result = await this.pool.query(
        `SELECT id, payload FROM outbox WHERE status = 'pending' ORDER BY id ASC LIMIT $1`,
        [limit],
      );
      return result.rows.map((row: { id: string | number; payload: OutboxEvent }) => ({
        id: Number(row.id),
        payload: row.payload,
      }));
    } catch (error) {
      console.error("❌ [Outbox] Erreur pullPending:", error);
      throw error;
    }
  }

  /**
   * Marque les lignes comme synced (après ACK Kafka).
   */
  public async markSynced(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      await this.pool.query(
        `UPDATE outbox SET status = 'synced', synced_at = now() WHERE id = ANY($1)`,
        [ids],
      );
    } catch (error) {
      console.error("❌ [Outbox] Erreur markSynced:", error);
      throw error;
    }
  }

  /**
   * Supprime les lignes synced plus vieilles que `retentionDays` jours.
   * Retourne le nombre de lignes purgées (observabilité / traçabilité).
   */
  public async purgeSynced(retentionDays: number): Promise<number> {
    try {
      const result = await this.pool.query(
        `DELETE FROM outbox WHERE status = 'synced' AND synced_at < now() - ($1 || ' days')::interval`,
        [retentionDays],
      );
      return result.rowCount ?? 0;
    } catch (error) {
      console.error("❌ [Outbox] Erreur purgeSynced:", error);
      throw error;
    }
  }

  /**
   * Nombre de lignes pending (lag store-and-forward) pour logs/métriques.
   */
  public async pendingCount(): Promise<number> {
    try {
      const result = await this.pool.query(
        `SELECT count(*)::int AS count FROM outbox WHERE status = 'pending'`,
      );
      return result.rows[0]?.count ?? 0;
    } catch (error) {
      console.error("❌ [Outbox] Erreur pendingCount:", error);
      throw error;
    }
  }

  /**
   * Ferme proprement le pool de connexions.
   */
  public async close(): Promise<void> {
    try {
      await this.pool.end();
      console.log("👋 [Outbox] Pool Postgres fermé");
    } catch (error) {
      console.error("❌ [Outbox] Erreur close:", error);
    }
  }
}

export default Outbox;
