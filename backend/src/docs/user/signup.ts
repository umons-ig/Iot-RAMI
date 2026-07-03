const signup = {
  post: {
    tags: ["User"],
    summary: "Signup",
    description:
      "Create a new user account. Role defaults to 'regular' and must be elevated by an admin",
    operationId: "signup",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: [
              "email",
              "password",
              "firstName",
              "lastName",
              "dateOfBirth",
              "sex",
            ],
            properties: {
              email: { type: "string", format: "email" },
              password: { type: "string", minLength: 12 },
              firstName: { type: "string" },
              lastName: { type: "string" },
              dateOfBirth: { type: "string", format: "date" },
              sex: { type: "string", enum: ["male", "female"] },
            },
          },
        },
      },
    },
    responses: {
      "201": {
        description: "User created",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UserLogin" },
          },
        },
      },
      "400": {
        description: "Validation error or email already in use",
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

export { signup };
