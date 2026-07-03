"use strict";
/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("UserMeasurementTypeRequests", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      measurementType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.DataTypes.ENUM("pending", "accepted", "refused"),
        defaultValue: "pending",
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("UserMeasurementTypeRequests");
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_UserMeasurementTypeRequests_status"
    );
  },
};
