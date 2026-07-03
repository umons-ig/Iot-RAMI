const deleteMeasurement = {
  delete: {
    tags: ["Measurement"],
    summary: "Delete a measurement",
    description: "Delete a measurement",
    operationId: "deleteMeasurement",
    parameters: [
      {
        name: "id",
        in: "path",
        description: "The measurement id",
        required: true,
        schema: {
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        description: "Measurement deleted",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/MeasurementDelete",
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
        description: "Measurement not found",
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

export { deleteMeasurement };
