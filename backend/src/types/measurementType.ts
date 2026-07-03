import { Model, BuildOptions } from "sequelize";

// MeasurementType

interface MeasurementTypeCreation {
  id?: string;
  name?: string;
}

interface MeasurementType {
  id: string;
  name: string;
}

type MeasurementTypeModel = Model<MeasurementType, MeasurementTypeCreation>;

// Allow you to define a static method to define associations at the model class level
type MeasurementTypeStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions
  ): MeasurementTypeModel;
};

export type {
  MeasurementType,
  MeasurementTypeCreation,
  MeasurementTypeModel,
  MeasurementTypeStatic,
};
