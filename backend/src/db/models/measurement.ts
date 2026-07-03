import { Sequelize } from "sequelize";
import {
  MeasurementCreation,
  MeasurementModel,
  MeasurementStatic,
} from "#/measurement";

const defineMeasurement = (
  sequelize: Sequelize,
  DataTypes: any
): MeasurementStatic => {
  const Measurement = <MeasurementStatic>sequelize.define<
    MeasurementModel,
    MeasurementCreation
  >(
    "Measurement",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      idSensor: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      idMeasurementType: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      value: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      timestamps: false,
    }
  );

  Measurement.associate = (models: any) => {
    Measurement.hasOne(models.Sensor, {
      foreignKey: "id",
      sourceKey: "idSensor",
      as: "sensor",
    });

    Measurement.hasOne(models.MeasurementType, {
      foreignKey: "id",
      sourceKey: "idMeasurementType",
      as: "measurementType",
    });
  };
  return Measurement;
};

export default defineMeasurement;
