"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Sensors", "zoneId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "Zones", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL", // un capteur orphelin devient « non classé », jamais bloquant
    });

    await queryInterface.addIndex("Sensors", ["zoneId"], {
      name: "idx_sensors_zone",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("Sensors", "idx_sensors_zone");
    await queryInterface.removeColumn("Sensors", "zoneId");
  },
};
