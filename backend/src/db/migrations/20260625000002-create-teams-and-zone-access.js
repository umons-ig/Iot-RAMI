"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── Teams ──
    await queryInterface.createTable("Teams", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // ── TeamMembers (user ∈ team) ──
    await queryInterface.createTable("TeamMembers", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      teamId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Teams", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex("TeamMembers", ["teamId", "userId"], {
      unique: true,
      name: "uniq_team_member",
    });

    // ── UserZoneAccesses (user → zone, cascade) ──
    await queryInterface.createTable("UserZoneAccesses", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      zoneId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Zones", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex("UserZoneAccesses", ["userId", "zoneId"], {
      unique: true,
      name: "uniq_user_zone",
    });

    // ── TeamZoneAccesses (team → zone, cascade) ──
    await queryInterface.createTable("TeamZoneAccesses", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      teamId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Teams", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      zoneId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Zones", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex("TeamZoneAccesses", ["teamId", "zoneId"], {
      unique: true,
      name: "uniq_team_zone",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("TeamZoneAccesses");
    await queryInterface.dropTable("UserZoneAccesses");
    await queryInterface.dropTable("TeamMembers");
    await queryInterface.dropTable("Teams");
  },
};
