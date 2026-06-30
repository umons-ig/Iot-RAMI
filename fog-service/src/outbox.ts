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

  // ─── Intégration Home Assistant : capteurs exposés (opt-in par capteur) ───────
  // Persisté ici (Postgres) pour survivre aux redémarrages du conteneur fog.

  /** Crée les tables `ha_exposed` + `ha_announced` si absentes. Idempotent. */
  public async initHaExposed(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ha_exposed (
        topic TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    // Mesures déjà annoncées à HA (config retained publiée) par capteur. Persisté
    // pour pouvoir NETTOYER les entités HA même après un redémarrage du fog (sinon
    // les configs retained restent orphelines au toggle-off — cf. revue PR #89).
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ha_announced (
        topic TEXT NOT NULL,
        measure_type TEXT NOT NULL,
        PRIMARY KEY (topic, measure_type)
      );
    `);
  }

  /** Liste des topics capteurs actuellement exposés à Home Assistant. */
  public async loadHaExposed(): Promise<string[]> {
    const result = await this.pool.query(`SELECT topic FROM ha_exposed`);
    return result.rows.map((row: { topic: string }) => row.topic);
  }

  /** Active/désactive l'exposition HA d'un capteur (persisté). */
  public async setHaExposed(topic: string, enabled: boolean): Promise<void> {
    if (enabled) {
      await this.pool.query(
        `INSERT INTO ha_exposed (topic) VALUES ($1) ON CONFLICT (topic) DO NOTHING`,
        [topic],
      );
    } else {
      await this.pool.query(`DELETE FROM ha_exposed WHERE topic = $1`, [topic]);
    }
  }

  /** Toutes les mesures annoncées à HA (pour repeupler l'index au démarrage). */
  public async loadHaAnnounced(): Promise<Array<{ topic: string; measureType: string }>> {
    const result = await this.pool.query(`SELECT topic, measure_type FROM ha_announced`);
    return result.rows.map((row: { topic: string; measure_type: string }) => ({
      topic: row.topic,
      measureType: row.measure_type,
    }));
  }

  /** Mémorise qu'une mesure a été annoncée à HA pour ce capteur. */
  public async addHaAnnounced(topic: string, measureType: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO ha_announced (topic, measure_type) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [topic, measureType],
    );
  }

  /** Oublie toutes les mesures annoncées d'un capteur (après nettoyage HA). */
  public async clearHaAnnounced(topic: string): Promise<void> {
    await this.pool.query(`DELETE FROM ha_announced WHERE topic = $1`, [topic]);
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
