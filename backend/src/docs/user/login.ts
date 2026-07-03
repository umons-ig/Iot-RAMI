const login = {
  post: {
    tags: ["User"],
    summary: "Login",
    description: "Authenticate with email and password, receive a JWT token",
    operationId: "login",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["email", "password"],
            properties: {
              email: { type: "string", format: "email" },
              password: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Authenticated — returns JWT token and user info",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UserLogin" },
          },
        },
      },
      "400": {
        description: "Invalid credentials",
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

export { login };
