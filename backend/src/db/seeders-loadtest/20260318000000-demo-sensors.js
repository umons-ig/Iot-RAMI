"use strict";

const { v4: uuidv4 } = require("uuid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sensors = Array.from({ length: 101 }, (_, i) => ({
      id: uuidv4(),
      name: `load-test-${i}`,
      topic: `load-test-${i}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await queryInterface.bulkInsert("Sensors", sensors);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Sensors", {
      name: Array.from({ length: 101 }, (_, i) => `load-test-${i}`),
    });
  },
};
