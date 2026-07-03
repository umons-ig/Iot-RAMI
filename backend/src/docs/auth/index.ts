const authPaths = {
  "/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "Logout",
      description:
        "Clears the HttpOnly refresh token cookie. Call this on user logout.",
      operationId: "logout",
      responses: {
        "200": {
          description: "Logged out successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/auth/refresh": {
    post: {
      tags: ["Auth"],
      summary: "Refresh access token",
      description:
        "Uses the HttpOnly refresh token cookie to issue a new access token. The refresh token is automatically rotated (a new one is set in the cookie).",
      operationId: "refresh",
      responses: {
        "200": {
          description: "New access token issued",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: {
                    type: "string",
                    description: "New JWT access token",
                  },
                  expiresAt: {
                    type: "number",
                    description:
                      "Expiration timestamp in ms (Date.now() + 15min)",
                  },
                },
              },
            },
          },
        },
        "401": {
          description: "No refresh token, or token is invalid / expired",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
};

export { authPaths };
