import { sensorPaths } from "@docs/sensor";
import { measurementTypePaths } from "@docs/measurementType";
import { measurementPaths } from "@docs/measurement";
import { userPaths } from "@docs/user";
import { sessionPaths } from "@docs/session";
import { authPaths } from "@docs/auth";
import { thresholdPaths } from "@docs/threshold";
import { zonePaths } from "@docs/zone";
import { teamPaths } from "@docs/team";

const paths = {
  paths: {
    ...sensorPaths,
    ...measurementTypePaths,
    ...measurementPaths,
    ...userPaths,
    ...sessionPaths,
    ...authPaths,
    ...thresholdPaths,
    ...zonePaths,
    ...teamPaths,
  },
};

export { paths };
