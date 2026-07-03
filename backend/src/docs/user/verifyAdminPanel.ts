const verifyAdminPanel = {
  get: {
    tags: ["User"],
    summary: "Verify admin panel access",
    description:
      "Returns 200 if the authenticated user has privileged or admin rights, 401 otherwise",
    operationId: "verifyAdminPanel",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Access granted",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/User" } },
        },
      },
      "400": {
        description: "Missing or malformed token",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      "401": {
        description: "Insufficient role",
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

export { verifyAdminPanel };
