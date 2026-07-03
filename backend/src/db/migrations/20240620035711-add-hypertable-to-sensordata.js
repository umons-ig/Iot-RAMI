"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
    );

    await queryInterface.sequelize.query(
      "SELECT create_hypertable('sensordata', 'time');"
    );
  },

  async down(queryInterface, Sequelize) {
    // Nothing to do here because if you are undoing migrations next step is the deletion of the curent table
  },
};
