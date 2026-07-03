import { Model, BuildOptions } from "sequelize";

interface SensorDataCreation {
  time: Date;
  idSensor: string;
  value: number;
  idMeasurementType: string;
}

interface SensorData {
  time: Date;
  idSensor: string;
  value: number;
  idMeasurementType: string;
}

type SensorDataModel = Model<SensorData, SensorDataCreation>;

// Allow you to define a static method to define associations at the model class level
type SensorDataStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions
  ): SensorDataModel;
};

export type {
  SensorData,
  SensorDataCreation,
  SensorDataModel,
  SensorDataStatic,
};
