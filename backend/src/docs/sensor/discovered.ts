const discovered = {
  get: {
    tags: ["Sensor"],
    summary: "Get auto-discovered sensors",
    description:
      "Returns sensors detected via MQTT PING that are not yet registered in the database",
    operationId: "getDiscoveredSensors",
    responses: {
      "200": {
        description: "List of discovered sensors",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: { $ref: "#/components/schemas/DiscoveredSensor" },
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
};

export { discovered };
