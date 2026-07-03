import { Sequelize } from "sequelize";
import type {
  MeasurementTypeCreation,
  MeasurementTypeModel,
  MeasurementTypeStatic,
} from "#/measurementType";

const defineMeasurementType = (
  sequelize: Sequelize,
  DataTypes: any
): MeasurementTypeStatic => {
  const MeasurementType = <MeasurementTypeStatic>sequelize.define<
    MeasurementTypeModel,
    MeasurementTypeCreation
  >(
    "MeasurementType",
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
    },
    {
      timestamps: false,
    }
  );

  return MeasurementType;
};
export default defineMeasurementType;
