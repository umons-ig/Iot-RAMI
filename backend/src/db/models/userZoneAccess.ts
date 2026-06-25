import { Sequelize } from "sequelize";
import type {
  UserZoneAccessCreation,
  UserZoneAccessModel,
  UserZoneAccessStatic,
} from "#/team";

const defineUserZoneAccessModel = (
  sequelize: Sequelize,
  DataTypes: any
): UserZoneAccessStatic => {
  const UserZoneAccess = <UserZoneAccessStatic>sequelize.define<
    UserZoneAccessModel,
    UserZoneAccessCreation
  >(
    "UserZoneAccess",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      zoneId: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      timestamps: false,
      indexes: [{ unique: true, fields: ["userId", "zoneId"] }],
    }
  );

  UserZoneAccess.associate = (models: any) => {
    UserZoneAccess.belongsTo(models.User, {
      foreignKey: "userId",
      targetKey: "id",
    });
    UserZoneAccess.belongsTo(models.Zone, {
      foreignKey: "zoneId",
      targetKey: "id",
    });
  };

  return UserZoneAccess;
};
export default defineUserZoneAccessModel;
