const update = {
  put: {
    tags: ["Sensor"],
    summary: "Update a sensor name",
    description: "Update a sensor name",
    operationId: "updateSensor",
    parameters: [
      {
        name: "id",
        in: "path",
        description: "The sensor id",
        required: true,
        schema: {
          type: "string",
        },
      },
    ],
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
      200: {
        description: "Sensor updated",
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
      404: {
        description: "Sensor not found",
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

export { update };
