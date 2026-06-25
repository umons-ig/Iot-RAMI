import { Sequelize } from "sequelize";
import type { TeamCreation, TeamModel, TeamStatic } from "#/team";

const defineTeamModel = (sequelize: Sequelize, DataTypes: any): TeamStatic => {
  const Team = <TeamStatic>sequelize.define<TeamModel, TeamCreation>(
    "Team",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
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
    { timestamps: true }
  );

  Team.associate = (models: any) => {
    Team.hasMany(models.TeamMember, { foreignKey: "teamId", sourceKey: "id" });
    Team.hasMany(models.TeamZoneAccess, {
      foreignKey: "teamId",
      sourceKey: "id",
    });
    // Membres et zones via tables de liaison (pratique pour les includes).
    Team.belongsToMany(models.User, {
      through: models.TeamMember,
      foreignKey: "teamId",
      otherKey: "userId",
      as: "members",
    });
    Team.belongsToMany(models.Zone, {
      through: models.TeamZoneAccess,
      foreignKey: "teamId",
      otherKey: "zoneId",
      as: "zones",
    });
  };

  return Team;
};
export default defineTeamModel;
