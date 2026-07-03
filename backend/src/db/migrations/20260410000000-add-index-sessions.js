"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_sensor ON "Sessions" ("idSensor");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_active ON "Sessions" ("endedAt") WHERE "endedAt" IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_sessions_sensor;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_sessions_active;
    `);
  },
};
