import express from "express";

import {
  getAllRoleWithWorseRole,
  haveRightsToAcessToAdminPanel,
  login,
  signup,
  updateUserInformation,
  updateRole,
  getUserSessions,
} from "@controllers/user";
import { auth, authAdmin } from "@middlewares/auth";
import {
  addUsersToSensor,
  askForSensorAccess,
  getUserSensorsAccess,
  removeUserFromSensor,
} from "@controllers/userSensor";

const router = express.Router();

router
  .post("/login", login)
  .post("/signup", signup)
  .put("/update", auth, updateUserInformation)
  .put("/update/role", authAdmin, updateRole)
  .get("/verify/adminPanel", auth, haveRightsToAcessToAdminPanel)
  .get("/all", auth, getAllRoleWithWorseRole)
  .get("/:id/sessions", auth, getUserSessions)
  .get("/:id/sessions/on/sensor/:idSensor", auth, getUserSessions)
  .post("/sensors/access", authAdmin, addUsersToSensor)
  .delete("/sensors/access", authAdmin, removeUserFromSensor)
  .get("/sensors/access", authAdmin, getUserSensorsAccess)
  .post("/sensors/access/ask", auth, askForSensorAccess);

export { router as userRoutes };
