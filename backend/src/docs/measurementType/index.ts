import { get } from "@docs/measurementType/get";
import { create } from "@docs/measurementType/create";
import { update } from "@docs/measurementType/update";
import { deleteMeasurementType } from "@docs/measurementType/delete";

const paths = {
  "/measurementTypes": {
    ...get,
    ...create,
    ...update,
    ...deleteMeasurementType,
  },
  "/measurementTypes/discovered": {
    get: {
      tags: ["MeasurementType"],
      summary: "Get discovered measurement types",
      description:
        "Returns measurement types seen in incoming MQTT payloads but not yet registered in the database.",
      operationId: "getDiscoveredMeasurementTypes",
      parameters: [],
      responses: {
        "200": {
          description: "List of discovered measurement type names",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { type: "string" },
                example: ["ecg", "temperature"],
              },
            },
          },
        },
        "500": {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
};

export { paths as measurementTypePaths };
