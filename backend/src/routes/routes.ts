import { sensorRoutes } from "@routes/sensor";
import { sessionRoutes } from "@routes/session";
import { measurementTypeRoutes } from "@routes/measurementType";
import { measurementRoutes } from "@routes/measurement";
import { homeRoutes } from "@routes/home";
import { userRoutes } from "@routes/user";
import { authRoutes } from "@routes/auth";
import { thresholdRoutes } from "@routes/threshold";
import { zoneRoutes } from "@routes/zone";
import { teamRoutes } from "@routes/team";

const routes = [
  { path: "/sensors", handler: sensorRoutes },
  { path: "/zones", handler: zoneRoutes },
  { path: "/teams", handler: teamRoutes },
  { path: "/sessions", handler: sessionRoutes },
  { path: "/measurementTypes", handler: measurementTypeRoutes },
  { path: "/measurements", handler: measurementRoutes },
  {
    path: "/users",
    handler: userRoutes,
  },
  {
    path: "/auth",
    handler: authRoutes,
  },
  {
    path: "/",
    handler: homeRoutes,
  },
  {
    path: "/thresholds",
    handler: thresholdRoutes,
  },
];

export { routes };
