import { create } from "@docs/threshold/create";
import { getBySensor } from "@docs/threshold/getBySensor";
import { update } from "@docs/threshold/update";
import { deleteThreshold } from "@docs/threshold/delete";

const paths = {
  "/thresholds": { ...create },
  "/thresholds/{id}": { ...update, ...deleteThreshold },
  "/thresholds/sensor/{idSensor}": { ...getBySensor },
};

export { paths as thresholdPaths };
