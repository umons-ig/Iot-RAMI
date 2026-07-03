"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert("MeasurementTypes", [
      { id: "f1a2b3c4-0001-4000-8000-000000000001", name: "breathing_rate" },
      { id: "f1a2b3c4-0001-4000-8000-000000000002", name: "heart_rate" },
      { id: "f1a2b3c4-0001-4000-8000-000000000003", name: "distance" },
      { id: "f1a2b3c4-0001-4000-8000-000000000004", name: "x_position" },
      { id: "f1a2b3c4-0001-4000-8000-000000000005", name: "y_position" },
      { id: "f1a2b3c4-0001-4000-8000-000000000006", name: "people_count" },
    ]);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("MeasurementTypes", {
      name: [
        "breathing_rate",
        "heart_rate",
        "distance",
        "x_position",
        "y_position",
        "people_count",
      ],
    });
  },
};
