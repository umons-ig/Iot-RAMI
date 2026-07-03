const get = {
  get: {
    tags: ["Measurement"],
    summary: "Get all measurement or measurement by id",
    description: "Get all measurement or measurement by id",
    operationId: "getMeasurement",
    parameters: [
      {
        name: "id",
        in: "path",
        schema: {
          type: "string",
        },
        required: false,
        description: "Measurement id",
      },
      {
        name: "date",
        in: "query",
        schema: {
          type: "string",
        },
        required: false,
        description: "Measurement date",
      },
      {
        name: "type",
        in: "query",
        schema: {
          type: "string",
        },
        required: false,
        description: "Measurement type",
      },
      {
        name: "sensor",
        in: "query",
        schema: {
          type: "string",
        },
        required: false,
        description: "Measurement sensor",
      },
      {
        name: "number",
        in: "query",
        schema: {
          type: "string",
        },
        required: false,
        description: "Measurement number",
      },
      {
        name: "sample",
        in: "query",
        schema: {
          type: "string",
          enum: [
            "secondly",
            "midminutely",
            "minutely",
            "quarterhourly",
            "halfhourly",
            "hourly",
            "daily",
            "weekly",
            "fortnightly",
            "monthly",
            "quarterly",
            "halfyearly",
            "yearly",
            "decade",
            "century",
            "millennium",
          ],
        },
      },
      {
        name: "average",
        in: "query",
        schema: {
          type: "string",
          enum: ["true", "True", "TRUE"],
        },
      },
    ],
    responses: {
      "200": {
        description: "Measurement were obtained",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Measurement",
            },
          },
        },
      },
      "400": {
        description: "Measurement were not obtained due to invalid parameters",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      "404": {
        description: "Measurement were not found due to invalid id",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
    },
  },
};

export { get };
