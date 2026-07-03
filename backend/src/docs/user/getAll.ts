const getAll = {
  get: {
    tags: ["User"],
    summary: "Get all users",
    description:
      "Returns all users with a role lower than the authenticated user's role",
    operationId: "getAll",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "List of users",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: { $ref: "#/components/schemas/User" },
            },
          },
        },
      },
      "401": {
        description: "Unauthorized",
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

export { getAll };
