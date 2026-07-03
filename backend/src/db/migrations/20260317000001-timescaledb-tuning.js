"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Réduire l'intervalle de chunk à 1 jour (s'applique aux futurs chunks uniquement)
    await queryInterface.sequelize.query(`
      SELECT set_chunk_time_interval('sensordata', INTERVAL '1 day');
    `);

    // Activer la compression columnar
    await queryInterface.sequelize.query(`
      ALTER TABLE sensordata SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = '"idSensor","idMeasurementType"',
        timescaledb.compress_orderby = 'time DESC'
      );
    `);

    // Politique de compression automatique après 7 jours
    await queryInterface.sequelize.query(`
      SELECT add_compression_policy('sensordata', INTERVAL '7 days');
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      SELECT remove_compression_policy('sensordata');
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE sensordata SET (timescaledb.compress = false);
    `);
  },
};
