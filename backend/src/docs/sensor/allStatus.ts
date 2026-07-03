const allStatus = {
  get: {
    tags: ["Sensor"],
    summary: "Get status of all sensors",
    description:
      "Returns the publication status of every registered sensor in a single request. Status is derived from active sessions in DB (no PING).",
    operationId: "getAllSensorsStatus",
    parameters: [],
    responses: {
      200: {
        description: "Map of sensor name to status",
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: {
                type: "string",
                enum: ["publishing", "offline"],
              },
              example: {
                "ESP32-DHT22": "publishing",
                "ESP32-ECG": "offline",
              },
            },
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
};

export { allStatus };
