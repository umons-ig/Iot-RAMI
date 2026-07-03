const deleteMeasurementType = {
  delete: {
    tags: ["MeasurementType"],
    summary: "Delete a measurement type",
    description: "Delete a measurement type",
    operationId: "deleteMeasurementType",
    parameters: [
      {
        name: "id",
        in: "path",
        description: "The measurement type id",
        required: true,
        schema: {
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        description: "MeasurementType deleted",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/MeasurementTypeDelete",
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
        description: "MeasurementType not found",
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

export { deleteMeasurementType };
