import { Model, BuildOptions } from "sequelize";

/** ============================ SESSION MODEL ============================
A session represents a period of activity of a sensor, managed by the fog service.
Sessions are created automatically when the fog sends a START event via Kafka,
and closed when the fog sends a STOP event (or via admin).
 */

interface SessionCreation {
  id?: string;
  idFog?: string;
  idSensor: string;
  createdAt: Date;
  endedAt?: Date;
}

interface Session {
  id: string;
  idFog?: string;
  idSensor: string;
  createdAt: Date;
  endedAt?: Date;
  updatedAt: Date;
}

type SessionModel = Model<Session, SessionCreation>;

// Allow you to define a static method to define associations at the model class level
type SessionStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (values?: Record<string, unknown>, options?: BuildOptions): SessionModel;
};

export type { Session, SessionCreation, SessionModel, SessionStatic };
