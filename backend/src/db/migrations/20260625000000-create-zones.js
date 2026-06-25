"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Zones", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      parentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Zones", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE", // supprimer une zone supprime son sous-arbre
      },
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

    await queryInterface.addIndex("Zones", ["parentId"], {
      name: "idx_zones_parent",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Zones");
  },
};
