const status = {
  get: {
    tags: ["Sensor"],
    summary: "Get real-time sensor status",
    description:
      "Sends a PING to the sensor and returns its current connectivity status. Times out after 500 ms",
    operationId: "getSensorStatus",
    parameters: [
      {
        name: "sensorName",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "Sensor name",
      },
    ],
    responses: {
      "200": {
        description: "Sensor status",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SensorStatus" },
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

export { status };
