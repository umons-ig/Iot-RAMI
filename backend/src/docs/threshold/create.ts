const create = {
  post: {
    tags: ["Threshold"],
    summary: "Create a threshold",
    description:
      "Create a min/max alert threshold for a sensor and measurement type pair. The pair (idSensor, idMeasurementType) must be unique.",
    operationId: "createThreshold",
    security: [{ bearerAuth: [] }],
    parameters: [],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/ThresholdCreate",
          },
        },
      },
    },
    responses: {
      201: {
        description: "Threshold created",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Threshold",
            },
          },
        },
      },
      400: {
        description: "Missing required fields (idSensor or idMeasurementType)",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      500: {
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

export { create };
