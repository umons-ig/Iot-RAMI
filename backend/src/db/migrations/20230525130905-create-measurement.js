"use strict";
/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "Measurements",
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        idSensor: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: "Sensors",
            key: "id",
          },
        },
        idMeasurementType: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: "MeasurementTypes",
            key: "id",
          },
        },
        value: {
          type: Sequelize.FLOAT,
          allowNull: false,
        },
        timestamp: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      },
      {
        timestamps: false,
      }
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Measurements");
  },
};
