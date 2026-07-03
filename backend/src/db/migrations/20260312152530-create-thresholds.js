"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "Thresholds",
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
        minValue: {
          type: Sequelize.FLOAT,
          allowNull: true,
        },
        maxValue: {
          type: Sequelize.FLOAT,
          allowNull: true,
        },
      },
      {
        timestamps: false,
      }
    );
    await queryInterface.addIndex(
      "Thresholds",
      ["idSensor", "idMeasurementType"],
      {
        unique: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Thresholds");
  },
};
