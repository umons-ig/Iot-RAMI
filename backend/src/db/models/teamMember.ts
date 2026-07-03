import { Sequelize } from "sequelize";
import type {
  TeamMemberCreation,
  TeamMemberModel,
  TeamMemberStatic,
} from "#/team";

const defineTeamMemberModel = (
  sequelize: Sequelize,
  DataTypes: any
): TeamMemberStatic => {
  const TeamMember = <TeamMemberStatic>sequelize.define<
    TeamMemberModel,
    TeamMemberCreation
  >(
    "TeamMember",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      teamId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      timestamps: false,
      indexes: [{ unique: true, fields: ["teamId", "userId"] }],
    }
  );

  TeamMember.associate = (models: any) => {
    TeamMember.belongsTo(models.Team, {
      foreignKey: "teamId",
      targetKey: "id",
    });
    TeamMember.belongsTo(models.User, {
      foreignKey: "userId",
      targetKey: "id",
    });
  };

  return TeamMember;
};
export default defineTeamMemberModel;
