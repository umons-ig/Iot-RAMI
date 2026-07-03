import { Sequelize } from "sequelize";
import type {
  TeamZoneAccessCreation,
  TeamZoneAccessModel,
  TeamZoneAccessStatic,
} from "#/team";

const defineTeamZoneAccessModel = (
  sequelize: Sequelize,
  DataTypes: any
): TeamZoneAccessStatic => {
  const TeamZoneAccess = <TeamZoneAccessStatic>sequelize.define<
    TeamZoneAccessModel,
    TeamZoneAccessCreation
  >(
    "TeamZoneAccess",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      teamId: { type: DataTypes.UUID, allowNull: false },
      zoneId: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      timestamps: false,
      indexes: [{ unique: true, fields: ["teamId", "zoneId"] }],
    }
  );

  TeamZoneAccess.associate = (models: any) => {
    TeamZoneAccess.belongsTo(models.Team, {
      foreignKey: "teamId",
      targetKey: "id",
    });
    TeamZoneAccess.belongsTo(models.Zone, {
      foreignKey: "zoneId",
      targetKey: "id",
    });
  };

  return TeamZoneAccess;
};
export default defineTeamZoneAccessModel;
