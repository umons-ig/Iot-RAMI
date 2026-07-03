const update = {
  put: {
    tags: ["MeasurementType"],
    summary: "Update a measurement type name",
    description: "Update a measurement type name",
    operationId: "updateMeasurementType",
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
    requestBody: {
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/MeasurementTypeCreate",
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: "MeasurementType updated",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/MeasurementType",
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

export { update };
