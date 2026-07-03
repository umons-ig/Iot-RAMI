"use strict";
/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("UserSensorAccesses", {
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
      sensorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Sensors",
          key: "id",
        },
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

    await queryInterface.createTable("UserSensorRequests", {
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
      sensorName: {
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
    await queryInterface.dropTable("UserSensorAccesses");
    await queryInterface.dropTable("UserSensorRequests");
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_UserSensorsRequests_status"
    );
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_UserSensorAccesses_status"
    );
  },
};
