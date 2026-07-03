import type { Options } from "sequelize";
import { Sequelize, DataTypes, Model } from "sequelize";
import { envs } from "@utils/env";

import defineMeasurement from "@models/measurement";
import defineMeasurementType from "@models/measurementType";
import defineSensorModel from "@models/sensor";
import defineSensorDataModel from "@models/sensorData";
import defineSessionDataModel from "@models/session";
import defineUserModel from "@models/user";
import defineUserSensorAccessModel from "@models/userSensorAccess";
import defineThresholdModel from "@models/threshold";
import defineZoneModel from "@models/zone";
import defineTeamModel from "@models/team";
import defineTeamMemberModel from "@models/teamMember";
import defineUserZoneAccessModel from "@models/userZoneAccess";
import defineTeamZoneAccessModel from "@models/teamZoneAccess";

import type { MeasurementStatic } from "#/measurement";
import type { MeasurementTypeStatic } from "#/measurementType";
import type { SensorDataStatic } from "#/sensorData";
import type { SensorStatic, UserSensorAccessStatic } from "#/sensor";
import type { SessionStatic } from "#/session";
import type { UserStatic } from "#/user";
import type { ThresholdStatic } from "@/types/threshold";
import type { ZoneStatic } from "#/zone";
import type {
  TeamStatic,
  TeamMemberStatic,
  UserZoneAccessStatic,
  TeamZoneAccessStatic,
} from "#/team";

export interface Database {
  Measurement: MeasurementStatic;
  MeasurementType: MeasurementTypeStatic;
  Sensor: SensorStatic;
  sensordata: SensorDataStatic;
  Session: SessionStatic;
  User: UserStatic;
  UserSensorAccess: UserSensorAccessStatic;
  Threshold: ThresholdStatic;
  Zone: ZoneStatic;
  Team: TeamStatic;
  TeamMember: TeamMemberStatic;
  UserZoneAccess: UserZoneAccessStatic;
  TeamZoneAccess: TeamZoneAccessStatic;
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
}

const options: Options = {
  dialect: "postgres",
  logging: false,
  host: envs.DB_HOST,
  port: envs.DB_PORT,
  database: envs.DB_NAME,
  username: envs.DB_USER,
  password: envs.DB_PASSWORD,
  pool: {
    max: 20,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
};
const sequelize = new Sequelize(options);

/* 
### RAMI1

The problem is that RAMI0 did not follow the sequelize documentation concerning the establishment of associations.
Therefore no join was possible. This part is precisely there to allow the addition of assoications. 

One last thing, RAMI0 defined associations "on one side only", theses are not valid, the sequelize documentation
specifies that setting up an association between two tables is done with the use of two keywords.
Please follow the sequelize documentation so that never happens again.
*/

// Built dynamically — typed at export via the Database interface
const db: Record<string, unknown> = {};

type DefineModelFunction = (
  sequelize: Sequelize,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataTypes: any
) => typeof Model;

const addModelToDb = (
  sequelize: Sequelize,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataTypes: any,
  defineModel: DefineModelFunction,
  target: Record<string, unknown>
): void => {
  const model = defineModel(sequelize, DataTypes);
  target[model.name] = model;
};

addModelToDb(sequelize, DataTypes, defineMeasurement, db);
addModelToDb(sequelize, DataTypes, defineMeasurementType, db);
addModelToDb(sequelize, DataTypes, defineSensorModel, db);
addModelToDb(sequelize, DataTypes, defineSensorDataModel, db);
addModelToDb(sequelize, DataTypes, defineSessionDataModel, db);
addModelToDb(sequelize, DataTypes, defineUserModel, db);
addModelToDb(sequelize, DataTypes, defineUserSensorAccessModel, db);
addModelToDb(sequelize, DataTypes, defineThresholdModel, db);
addModelToDb(sequelize, DataTypes, defineZoneModel, db);
addModelToDb(sequelize, DataTypes, defineTeamModel, db);
addModelToDb(sequelize, DataTypes, defineTeamMemberModel, db);
addModelToDb(sequelize, DataTypes, defineUserZoneAccessModel, db);
addModelToDb(sequelize, DataTypes, defineTeamZoneAccessModel, db);
// run `.associate` if applicable
Object.keys(db).map((modelName) => {
  const entry = db[modelName] as {
    associate?: (models: Record<string, unknown>) => void;
  };
  if (entry.associate) {
    entry.associate(db);
  }
});

// attach both our instance and Sequelize to our db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db as unknown as Database;
