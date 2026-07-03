"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // La compression et sa politique (7 jours) sont déjà activées dans
    // 20260317000001-timescaledb-tuning.js.
    // Cette migration ajoute uniquement la politique de rétention des données brutes.

    // Supprimer les données brutes de plus de 90 jours.
    // La valeur par défaut est 90 jours ; elle peut être ajustée manuellement
    // via `alter_data_retention_policy` si les besoins évoluent.
    await queryInterface.sequelize.query(`
      SELECT add_retention_policy('sensordata', INTERVAL '90 days');
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      SELECT remove_retention_policy('sensordata');
    `);
  },
};
