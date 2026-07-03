const deleteSensor = {
  delete: {
    tags: ["Sensor"],
    summary: "Delete a sensor",
    description: "Delete a sensor",
    operationId: "deleteSensor",
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
    responses: {
      200: {
        description: "Sensor deleted",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/SensorDelete",
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

export { deleteSensor };
