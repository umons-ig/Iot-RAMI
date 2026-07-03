import { Model, BuildOptions } from "sequelize";

interface MeasurementCreation {
  id?: string;
  idSensor: string;
  idMeasurementType: string;
  value: number;
  timestamp: Date;
}

interface Measurement {
  id: string;
  idSensor: string;
  idMeasurementType: string;
  value: number;
  timestamp: Date;
}

type MeasurementModel = Model<Measurement, MeasurementCreation>;

// Allow you to define a static method to define associations at the model class level
type MeasurementStatic = typeof Model & {
  associate: (models: any) => void;
} & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions
  ): MeasurementModel;
};

export type {
  Measurement,
  MeasurementCreation,
  MeasurementModel,
  MeasurementStatic,
};
