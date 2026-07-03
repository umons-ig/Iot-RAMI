import { create } from "@docs/measurement/create";
import { update } from "@docs/measurement/update";
import { deleteMeasurement } from "@docs/measurement/delete";
import { get } from "@docs/measurement/get";
import { createByGroup } from "@docs/measurement/createByGroup";

const paths = {
  "/measurements": {
    ...get,
    ...create,
    ...update,
    ...deleteMeasurement,
  },
  "/measurements/bulk": {
    ...createByGroup,
  },
};

export { paths as measurementPaths };
