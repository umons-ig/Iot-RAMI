import { Sequelize } from "sequelize";
import type { ZoneCreation, ZoneModel, ZoneStatic } from "#/zone";

const defineZoneModel = (sequelize: Sequelize, DataTypes: any): ZoneStatic => {
  const Zone = <ZoneStatic>sequelize.define<ZoneModel, ZoneCreation>(
    "Zone",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // Libellé libre du niveau hiérarchique : "company", "building", "floor", "room"…
      type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // null => zone racine ; sinon FK vers la zone parente.
      parentId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      timestamps: true,
      indexes: [{ fields: ["parentId"] }],
    }
  );

  Zone.associate = (models: any) => {
    // Auto-association : un nœud connaît son parent et ses enfants.
    Zone.belongsTo(models.Zone, { as: "parent", foreignKey: "parentId" });
    Zone.hasMany(models.Zone, { as: "children", foreignKey: "parentId" });

    // Une zone-feuille héberge des capteurs.
    Zone.hasMany(models.Sensor, { foreignKey: "zoneId", sourceKey: "id" });
  };

  return Zone;
};
export default defineZoneModel;
