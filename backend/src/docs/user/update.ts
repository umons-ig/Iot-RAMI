const update = {
  put: {
    tags: ["User"],
    summary: "Update user profile",
    description:
      "Update the authenticated user's profile information and optionally change password",
    operationId: "updateUser",
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              email: { type: "string", format: "email" },
              sex: { type: "string", enum: ["male", "female"] },
              password: {
                type: "string",
                description: "Current password (required to change password)",
              },
              newPassword: {
                type: "string",
                minLength: 12,
                description: "New password",
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "User updated",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UserLogin" },
          },
        },
      },
      "400": {
        description: "Validation error",
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

export { update };
