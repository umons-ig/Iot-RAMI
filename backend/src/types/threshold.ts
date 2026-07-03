import { Model, BuildOptions } from "sequelize";

interface ThresholdCreation {
  id?: string;
  idSensor: string;
  idMeasurementType: string;
  minValue?: number;
  maxValue?: number;
}

interface Threshold {
  id: string;
  idSensor: string;
  idMeasurementType: string;
  minValue?: number;
  maxValue?: number;
}

type ThresholdModel = Model<Threshold, ThresholdCreation>;

// Allow you to define a static method to define associations at the model class level
type ThresholdStatic = typeof Model & {
  associate: (models: any) => void;
} & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions
  ): ThresholdModel;
};

export type { Threshold, ThresholdCreation, ThresholdModel, ThresholdStatic };
