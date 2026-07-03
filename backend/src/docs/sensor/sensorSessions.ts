const sensorSessions = {
  get: {
    tags: ["Sensor"],
    summary: "Get sessions for a sensor",
    description:
      "Returns all recording sessions associated with a given sensor",
    operationId: "getSensorSessions",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Sensor UUID",
      },
    ],
    responses: {
      "200": {
        description: "List of sessions",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: { $ref: "#/components/schemas/Session" },
            },
          },
        },
      },
      "404": {
        description: "Sensor not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
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
};

export { sensorSessions };
