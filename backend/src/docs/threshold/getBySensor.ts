const getBySensor = {
  get: {
    tags: ["Threshold"],
    summary: "Get thresholds for a sensor",
    description:
      "Returns all alert thresholds configured for the given sensor.",
    operationId: "getThresholdBySensor",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "idSensor",
        in: "path",
        description: "Sensor UUID",
        required: true,
        schema: {
          type: "string",
          format: "uuid",
        },
      },
    ],
    responses: {
      200: {
        description: "List of thresholds for the sensor",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Threshold",
              },
            },
          },
        },
      },
      404: {
        description: "No thresholds found for the given sensor",
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

export { getBySensor };
