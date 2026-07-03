const create = {
  post: {
    tags: ["MeasurementType"],
    summary: "Create a new measurement type",
    description: "Create a new measurement type",
    operationId: "createMeasurementType",
    parameters: [],
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
      201: {
        description: "MeasurementType created",
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
