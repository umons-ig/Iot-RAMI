import { login } from "./login";
import { signup } from "./signup";
import { update } from "./update";
import { updateRole } from "./updateRole";
import { verifyAdminPanel } from "./verifyAdminPanel";
import { getAll } from "./getAll";

const paths = {
  "/users/login": { ...login },
  "/users/signup": { ...signup },
  "/users/update": { ...update },
  "/users/update/role": { ...updateRole },
  "/users/verify/adminPanel": { ...verifyAdminPanel },
  "/users/all": { ...getAll },
  "/users/{id}/sessions": {
    get: {
      tags: ["User"],
      summary: "Get all sessions for a user",
      operationId: "getUserSessions",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "User UUID",
        },
      ],
      responses: {
        "200": {
          description: "List of sessions for this user",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/Session" },
              },
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
  },
  "/users/{id}/sessions/on/sensor/{idSensor}": {
    get: {
      tags: ["User"],
      summary: "Get sessions for a user on a specific sensor",
      operationId: "getUserSessionsOnSensor",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "User UUID",
        },
        {
          name: "idSensor",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Sensor UUID",
        },
      ],
      responses: {
        "200": {
          description: "List of sessions for this user on this sensor",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/Session" },
              },
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
  },
  "/users/sensors/access": {
    get: {
      tags: ["User Access Control"],
      summary: "Get all user-sensor access entries (admin only)",
      operationId: "getUserSensorsAccess",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": { description: "List of access entries" },
        "401": {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
    post: {
      tags: ["User Access Control"],
      summary: "Grant a user access to a sensor",
      operationId: "addUsersToSensor",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["userName", "sensorName"],
              properties: {
                userName: { type: "string" },
                sensorName: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Access granted" },
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
      },
    },
    delete: {
      tags: ["User Access Control"],
      summary: "Revoke a user's access to a sensor",
      operationId: "removeUserFromSensor",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["userName", "sensorName"],
              properties: {
                userName: { type: "string" },
                sensorName: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Access revoked" },
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
      },
    },
  },
  "/users/sensors/access/ask": {
    post: {
      tags: ["User Access Control"],
      summary: "Request access to a sensor",
      operationId: "askForSensorAccess",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["sensorName"],
              properties: {
                sensorName: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Request submitted" },
        "400": {
          description: "Already has access or pending request",
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
      },
    },
  },
};

export { paths as userPaths };
