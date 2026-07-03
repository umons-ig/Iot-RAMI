import { exportCsv } from "@docs/session/exportCsv";

const paths = {
  "/sessions/new": {
    post: {
      tags: ["Session"],
      summary: "Create a session (client-side)",
      description:
        "Registers intent to start a recording session for a sensor. The fog service drives actual session creation",
      operationId: "createSessionOnClientSide",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["idSensor"],
              properties: {
                idSensor: {
                  type: "string",
                  format: "uuid",
                  description: "Sensor UUID",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description:
            "Session intent registered — returns the sensor MQTT topic",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  topic: {
                    type: "string",
                    description: "MQTT topic for the sensor",
                  },
                },
              },
            },
          },
        },
        "400": {
          description: "Invalid sensor ID",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        "404": {
          description: "Sensor not found",
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
  },
  "/sessions/new/on/server": {
    post: {
      tags: ["Session"],
      summary: "End a session (server-side)",
      description:
        "Called by the fog service to close an active session and record the end timestamp",
      operationId: "createSessionOnServerSide",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["idSession"],
              properties: {
                idSession: {
                  type: "string",
                  format: "uuid",
                  description: "Session UUID to close",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Session closed" },
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
  "/sessions": {
    get: {
      tags: ["Session"],
      summary: "Get all sessions",
      operationId: "getAllSessions",
      responses: {
        "200": {
          description: "List of all sessions",
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
    delete: {
      tags: ["Session"],
      summary: "Delete all sessions",
      operationId: "deleteAllSessions",
      responses: {
        "204": { description: "All sessions deleted" },
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
  "/sessions/active": {
    get: {
      tags: ["Session"],
      summary: "Get active sessions",
      description: "Returns all sessions that have started but not yet ended",
      operationId: "getAllActiveSessions",
      responses: {
        "200": {
          description: "List of active sessions",
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
  "/sessions/{id}": {
    get: {
      tags: ["Session"],
      summary: "Get session by ID",
      operationId: "getSessionById",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Session UUID",
        },
      ],
      responses: {
        "200": {
          description: "Session found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Session" },
            },
          },
        },
        "404": {
          description: "Session not found",
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
    delete: {
      tags: ["Session"],
      summary: "Delete a session and its sensor data",
      operationId: "deleteSession",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Session UUID",
        },
      ],
      responses: {
        "200": { description: "Session and associated sensor data deleted" },
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
  },
  "/sessions/{id}/export/csv": { ...exportCsv },
  "/sessions/{id}/aggregate": {
    get: {
      tags: ["Session"],
      summary: "Get aggregated sensor data for a session",
      description:
        "Returns 1-minute TimescaleDB continuous aggregate data (avg, min, max, count) for each measurement type during the session.",
      operationId: "getSessionAggregate",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Session UUID",
        },
      ],
      responses: {
        "200": {
          description: "Aggregated data rows",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    bucket: {
                      type: "string",
                      format: "date-time",
                      description: "1-minute time bucket",
                    },
                    avg_value: { type: "number" },
                    min_value: { type: "number" },
                    max_value: { type: "number" },
                    count: { type: "integer" },
                    idMeasurementType: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
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
  },
  "/sessions/{id}/data": {
    get: {
      tags: ["Session"],
      summary: "Get sensor data for a session",
      description:
        "Returns time-series sensor data recorded during the session, grouped by measurement type",
      operationId: "getSessionData",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Session UUID",
        },
      ],
      responses: {
        "200": {
          description: "Sensor data for the session",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    time: { type: "string", format: "date-time" },
                    value: { type: "number" },
                    idMeasurementType: { type: "string", format: "uuid" },
                    MeasurementType: {
                      $ref: "#/components/schemas/MeasurementType",
                    },
                  },
                },
              },
            },
          },
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
  },
};

export { paths as sessionPaths };
