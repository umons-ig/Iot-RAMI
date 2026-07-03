import { Sequelize } from "sequelize";
import {
  Status,
  UserSensorAccessCreation,
  UserSensorAccessModel,
  UserSensorAccessStatic,
} from "#/sensor";

const defineUserSensorAccessModel = (
  sequelize: Sequelize,
  DataTypes: any
): UserSensorAccessStatic => {
  const UserSensorAccess = <UserSensorAccessStatic>sequelize.define<
    UserSensorAccessModel,
    UserSensorAccessCreation
  >(
    "UserSensorAccess",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      sensorId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(Status.PENDING, Status.ACCEPTED, Status.REFUSED),
        defaultValue: Status.PENDING,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      timestamps: false,
    }
  );

  UserSensorAccess.associate = (models: any) => {
    UserSensorAccess.belongsTo(models.User, {
      foreignKey: "userId",
      targetKey: "id",
    });

    UserSensorAccess.belongsTo(models.Sensor, {
      foreignKey: "sensorId",
      targetKey: "id",
    });
  };

  return UserSensorAccess;
};

export default defineUserSensorAccessModel;
