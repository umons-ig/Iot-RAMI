import { get } from "@docs/sensor/get";
import { create } from "@docs/sensor/create";
import { update } from "@docs/sensor/update";
import { deleteSensor } from "@docs/sensor/delete";
import { discovered } from "@docs/sensor/discovered";
import { allStatus } from "@docs/sensor/allStatus";
import { status } from "@docs/sensor/status";
import { sensorSessions } from "@docs/sensor/sensorSessions";
import { topic } from "@docs/sensor/topic";

const paths = {
  "/sensors": { ...get, ...create },
  "/sensors/{id}": { ...update, ...deleteSensor },
  "/sensors/discovered": { ...discovered },
  "/sensors/connexion/online": { ...allStatus },
  "/sensors/connexion/online/{sensorName}": { ...status },
  "/sensors/{id}/sessions": { ...sensorSessions },
  "/sensors/{id}/topic": { ...topic },
};

export { paths as sensorPaths };
