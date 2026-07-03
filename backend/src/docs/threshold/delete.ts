const deleteThreshold = {
  delete: {
    tags: ["Threshold"],
    summary: "Delete a threshold",
    description: "Delete an alert threshold by its ID.",
    operationId: "deleteThreshold",
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
    responses: {
      200: {
        description: "Threshold deleted",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ThresholdDelete",
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

export { deleteThreshold };
