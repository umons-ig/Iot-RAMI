const get = {
  get: {
    tags: ["MeasurementType"],
    summary: "Get all measurement type or measurement type by id",
    description: "Get all measurement type or measurement type by id",
    operationId: "getMeasurementType",
    parameters: [
      {
        name: "id",
        in: "path",
        schema: {
          type: "string",
        },
        required: false,
        description: "MeasurementType id",
      },
    ],
    responses: {
      "200": {
        description: "MeasurementType were obtained",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/MeasurementType",
            },
          },
        },
      },
      "404": {
        description: "MeasurementType were not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      "500": {
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

export { get };
