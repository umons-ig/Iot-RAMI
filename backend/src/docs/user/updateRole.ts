const updateRole = {
  put: {
    tags: ["User"],
    summary: "Update user role",
    description:
      "Change a user's role. Requires privileged or admin rights — cannot elevate to a role higher than the requester's own",
    operationId: "updateRole",
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["email", "role"],
            properties: {
              email: { type: "string", format: "email" },
              role: {
                type: "string",
                enum: ["admin", "privileged", "regular"],
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Role updated",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/User" } },
        },
      },
      "400": {
        description: "Validation error or role escalation denied",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
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

export { updateRole };
