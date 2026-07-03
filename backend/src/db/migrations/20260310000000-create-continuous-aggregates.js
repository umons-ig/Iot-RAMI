"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Vue agrégée par minute : avg, min, max, count par capteur + type de mesure
    await queryInterface.sequelize.query(`
      CREATE MATERIALIZED VIEW sensordata_1min
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 minute', time) AS bucket,
        "idSensor",
        "idMeasurementType",
        AVG(value)   AS avg_value,
        MIN(value)   AS min_value,
        MAX(value)   AS max_value,
        COUNT(*)     AS count
      FROM sensordata
      GROUP BY bucket, "idSensor", "idMeasurementType"
      WITH NO DATA;
    `);

    // Politique de rafraîchissement automatique toutes les minutes
    await queryInterface.sequelize.query(`
      SELECT add_continuous_aggregate_policy('sensordata_1min',
        start_offset      => INTERVAL '1 hour',
        end_offset        => INTERVAL '1 minute',
        schedule_interval => INTERVAL '1 minute'
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      SELECT remove_continuous_aggregate_policy('sensordata_1min');
    `);
    await queryInterface.sequelize.query(`
      DROP MATERIALIZED VIEW IF EXISTS sensordata_1min;
    `);
  },
};
