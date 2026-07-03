const create = {
  post: {
    tags: ["Measurement"],
    summary: "Create a new measurement",
    description: "Create a new measurement",
    operationId: "createMeasurement",
    parameters: [],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/MeasurementCreate",
          },
        },
      },
      required: true,
    },
    responses: {
      201: {
        description: "Measurement created",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Measurement",
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
