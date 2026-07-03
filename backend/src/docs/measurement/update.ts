const update = {
  put: {
    tags: ["Measurement"],
    summary: "Update a measurement",
    description: "Update a measurement",
    operationId: "updateMeasurement",
    parameters: [
      {
        name: "id",
        in: "path",
        description: "Measurement id",
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
            $ref: "#/components/schemas/MeasurementCreate",
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: "Measurement updated",
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

export { update };
