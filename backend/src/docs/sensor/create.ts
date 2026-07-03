const create = {
  post: {
    tags: ["Sensor"],
    summary: "Create a new sensor",
    description: "Create a new sensor",
    operationId: "createSensor",
    parameters: [],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/SensorCreate",
          },
        },
      },
      required: true,
    },
    responses: {
      201: {
        description: "Sensor created",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Sensor",
            },
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      500: {
        description: "Server error",
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
export { create };
