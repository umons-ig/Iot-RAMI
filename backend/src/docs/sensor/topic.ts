const topic = {
  get: {
    tags: ["Sensor"],
    summary: "Get sensor MQTT topic",
    description:
      "Returns the full MQTT topic used to communicate with a sensor",
    operationId: "getSensorTopic",
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
        description: "Sensor topic",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SensorTopic" },
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

export { topic };
