const exportCsv = {
  get: {
    tags: ["Session"],
    summary: "Export session data as CSV",
    description:
      "Returns a CSV file with session metadata header lines and sensor time/value data rows",
    operationId: "exportSessionAsCsv",
    parameters: [
      {
        name: "id",
        in: "path",
        schema: { type: "string" },
        required: true,
        description: "Session UUID",
      },
    ],
    responses: {
      "200": {
        description: "CSV file downloaded",
        content: { "text/csv": { schema: { type: "string" } } },
      },
      "404": {
        description: "Session or sensor not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
};

export { exportCsv };
