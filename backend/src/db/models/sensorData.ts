import { Sequelize } from "sequelize";
import type {
  SensorDataCreation,
  SensorDataModel,
  SensorDataStatic,
} from "#/sensorData";

const defineSensorDataModel = (
  sequelize: Sequelize,
  DataTypes: any
): SensorDataStatic => {
  const SensorData = <SensorDataStatic>sequelize.define<
    SensorDataModel,
    SensorDataCreation
  >(
    "sensordata", // the hypertable name always remains in lower case
    {
      time: {
        type: DataTypes.DATE,
        allowNull: false,
        primaryKey: true,
      },
      idSensor: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "Sensors",
          key: "id",
        },
      },
      value: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      idMeasurementType: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
    },
    {
      timestamps: false,
    }
  );

  SensorData.associate = (models: any) => {
    SensorData.belongsTo(models.Sensor, {
      foreignKey: "idSensor",
      targetKey: "id",
    });
    SensorData.belongsTo(models.MeasurementType, {
      foreignKey: "idMeasurementType",
      targetKey: "id",
    });
  };

  return SensorData;
};

export default defineSensorDataModel;
