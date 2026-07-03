const createByGroup = {
  post: {
    tags: ["Measurement"],
    summary: "Create some new measurements",
    description: "Create some new measurements",
    operationId: "createMeasurementByGroup",
    parameters: [],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "array",
            items: {
              $ref: "#/components/schemas/MeasurementCreate",
            },
          },
        },
      },
      required: true,
    },
    responses: {
      201: {
        description: "Measurements created",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Measurement",
              },
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
export { createByGroup };
