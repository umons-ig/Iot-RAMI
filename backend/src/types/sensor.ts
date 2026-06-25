import { Model, BuildOptions } from "sequelize";

// Sensor

interface SensorCreation {
  id?: string;
  name?: string;
  topic?: string;
  zoneId?: string | null;
  createdAt?: string; // We need to convert the Date to string
  updatedAt?: string; // We need to convert the Date to string
}

interface Sensor {
  id: string;
  name: string;
  topic: string;
  zoneId?: string | null;
  createdAt?: string; // We need to convert the Date to string
  updatedAt?: string; // We need to convert the Date to string
}

type SensorModel = Model<Sensor, SensorCreation>;

// Allow you to define a static method to define associations at the model class level
type SensorStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (values?: Record<string, unknown>, options?: BuildOptions): SensorModel;
};

/****************************/
// UserSensorAccess

enum Status {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REFUSED = "refused",
}

interface UserSensorAccessCreation {
  id?: string;
  userId: string;
  sensorId: string;
  status?: Status;
  createdAt?: Date;
}

interface UserSensorAccess {
  id: string;
  userId: string;
  sensorId: string;
  status: Status;
  createdAt: Date;
}

type UserSensorAccessModel = Model<UserSensorAccess, UserSensorAccessCreation>;

// Allow you to define a static method to define associations at the model class level
type UserSensorAccessStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions
  ): UserSensorAccessModel;
};

export type {
  Sensor,
  SensorCreation,
  SensorModel,
  SensorStatic,
  UserSensorAccessModel,
  UserSensorAccess,
  UserSensorAccessCreation,
  UserSensorAccessStatic,
};

export { Status };
