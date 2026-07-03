import { Sequelize } from "sequelize";
import type {
  ThresholdCreation,
  ThresholdModel,
  ThresholdStatic,
} from "#/threshold";

const defineThresholdModel = (
  sequelize: Sequelize,
  DataTypes: any
): ThresholdStatic => {
  const Threshold = <ThresholdStatic>sequelize.define<
    ThresholdModel,
    ThresholdCreation
  >(
    "Threshold",
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
      minValue: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      maxValue: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
    },
    {
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["idSensor", "idMeasurementType"],
        },
      ],
    }
  );
  Threshold.associate = (models: any) => {
    Threshold.belongsTo(models.Sensor, {
      foreignKey: "idSensor",
      targetKey: "id",
    });
    Threshold.belongsTo(models.MeasurementType, {
      foreignKey: "idMeasurementType",
      targetKey: "id",
    });
  };

  return Threshold;
};
export default defineThresholdModel;
