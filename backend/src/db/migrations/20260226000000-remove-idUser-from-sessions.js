"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable("Sessions");
    if (tableDescription.idUser) {
      await queryInterface.removeColumn("Sessions", "idUser");
    }
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("Sessions", "idUser", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
    });
  },
};
