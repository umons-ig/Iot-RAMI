const get = {
  get: {
    tags: ["Sensor"],
    summary: "Get all sensors or sensors by id or sensor by name",
    description: "Get all sensors or sensors by id or sensor by name",
    operationId: "getSensors",
    parameters: [
      {
        name: "id",
        in: "path",
        schema: {
          type: "string",
        },
        required: false,
        description: "Sensor id",
      },
      {
        name: "name",
        in: "query",
        schema: {
          type: "string",
        },
        required: false,
        description: "Sensor name",
      },
    ],
    responses: {
      "200": {
        description: "Sensors were obtained",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Sensor",
            },
          },
        },
      },
      "404": {
        description: "Sensors were not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
    },
  },
};

export { get };
