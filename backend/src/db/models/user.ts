import { Sequelize } from "sequelize";
import type { UserCreation, UserModel, UserStatic } from "#/user";
import { Role, Sex } from "#/user";

const defineUserModel = (sequelize: Sequelize, DataTypes: any): UserStatic => {
  const User = <UserStatic>sequelize.define<UserModel, UserCreation>(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      dateOfBirth: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
          isDate: true,
        },
      },
      sex: {
        type: DataTypes.ENUM(Sex.MALE, Sex.FEMALE, Sex.OTHER, Sex.NOTSPECIFY),
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          min: 12,
        },
      },
      role: {
        type: DataTypes.ENUM(Role.ADMIN, Role.PRIVILEGED, Role.REGULAR),
        defaultValue: Role.REGULAR,
      },
      refreshTokenVersion: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
    },
    {
      timestamps: false,
    }
  );

  User.associate = (models: any) => {
    User.hasMany(models.UserSensorAccess, {
      foreignKey: "userId",
      sourceKey: "id",
    });
  };

  return User;
};

export default defineUserModel;
