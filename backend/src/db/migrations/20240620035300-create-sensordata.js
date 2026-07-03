"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "sensordata",
      {
        time: {
          type: Sequelize.DATE,
          allowNull: false,
          primaryKey: true,
        },
        idSensor: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
        },
        value: {
          type: Sequelize.FLOAT,
          allowNull: false,
        },
        idMeasurementType: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
        },
      },
      {
        timestamps: false,
      }
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("sensordata");
  },
};
