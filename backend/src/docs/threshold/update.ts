const update = {
  put: {
    tags: ["Threshold"],
    summary: "Update a threshold",
    description:
      "Update the min and/or max values of an existing threshold. Fields not provided are kept unchanged.",
    operationId: "updateThreshold",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: "id",
        in: "path",
        description: "Threshold UUID",
        required: true,
        schema: {
          type: "string",
          format: "uuid",
        },
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/ThresholdUpdate",
          },
        },
      },
    },
    responses: {
      200: {
        description: "Threshold updated",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Threshold",
            },
          },
        },
      },
      404: {
        description: "Threshold not found",
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

export { update };
