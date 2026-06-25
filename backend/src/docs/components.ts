const components = {
  components: {
    schemas: {
      Sensor: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", description: "Sensor UUID" },
          name: { type: "string", description: "Sensor name" },
          topic: { type: "string", description: "MQTT base topic" },
        },
      },
      SensorCreate: {
        type: "object",
        required: ["name", "topic"],
        properties: {
          name: { type: "string", description: "Sensor name" },
          topic: { type: "string", description: "MQTT base topic" },
        },
      },
      SensorDelete: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
      SensorStatus: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["offline", "publishing"],
            description: "Sensor status based on active session in DB",
          },
        },
      },
      SensorTopic: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Full MQTT topic for this sensor",
          },
        },
      },
      DiscoveredSensor: {
        type: "object",
        properties: {
          baseTopic: {
            type: "string",
            description: "MQTT base topic seen via PING",
          },
          firstSeenAt: { type: "string", format: "date-time" },
          lastSeenAt: { type: "string", format: "date-time" },
          count: {
            type: "integer",
            description: "Number of PING messages received",
          },
        },
      },
      MeasurementType: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "MeasurementType UUID",
          },
          name: {
            type: "string",
            description: "Measurement type name (e.g. ecg, temperature)",
          },
        },
      },
      MeasurementTypeCreate: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Measurement type name" },
        },
      },
      MeasurementTypeDelete: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
      Measurement: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "Measurement UUID",
          },
          date: {
            type: "string",
            format: "date-time",
            description: "Measurement timestamp (ISO 8601)",
          },
          value: { type: "number", description: "Measured value" },
          sensor: {
            type: "string",
            format: "uuid",
            description: "Sensor UUID",
          },
          type: { type: "string", description: "Measurement type name" },
        },
      },
      MeasurementCreate: {
        type: "object",
        required: ["date", "value", "sensor", "type"],
        properties: {
          date: { type: "string", format: "date-time" },
          value: { type: "number" },
          sensor: { type: "string", format: "uuid" },
          type: { type: "string" },
        },
      },
      MeasurementCreateByGroup: {
        type: "object",
        required: ["date", "value", "sensor", "type"],
        properties: {
          date: { type: "string", format: "date-time" },
          value: { type: "number" },
          sensor: { type: "string", format: "uuid" },
          type: {
            type: "string",
            format: "uuid",
            description: "MeasurementType UUID",
          },
        },
      },
      MeasurementDelete: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
      Session: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", description: "Session UUID" },
          idSensor: {
            type: "string",
            format: "uuid",
            description: "Sensor UUID",
          },
          idFog: { type: "string", description: "Fog service identifier" },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Session start time",
          },
          endedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
            description: "Session end time (null if still active)",
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", description: "User UUID" },
          email: { type: "string", format: "email" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          dateOfBirth: { type: "string", format: "date" },
          sex: { type: "string", enum: ["male", "female"] },
          role: { type: "string", enum: ["admin", "privileged", "regular"] },
        },
      },
      UserLogin: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          dateOfBirth: { type: "string", format: "date" },
          sex: { type: "string", enum: ["male", "female"] },
          role: { type: "string", enum: ["admin", "privileged", "regular"] },
          token: { type: "string", description: "JWT token" },
          expiresAt: {
            type: "integer",
            description: "Token expiry timestamp (ms since epoch)",
          },
        },
      },
      Threshold: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", description: "Threshold UUID" },
          idSensor: {
            type: "string",
            format: "uuid",
            description: "Sensor UUID",
          },
          idMeasurementType: {
            type: "string",
            format: "uuid",
            description: "MeasurementType UUID",
          },
          minValue: {
            type: "number",
            nullable: true,
            description: "Minimum allowed value (null = no lower bound)",
          },
          maxValue: {
            type: "number",
            nullable: true,
            description: "Maximum allowed value (null = no upper bound)",
          },
        },
      },
      ThresholdCreate: {
        type: "object",
        required: ["idSensor", "idMeasurementType"],
        properties: {
          idSensor: { type: "string", format: "uuid" },
          idMeasurementType: { type: "string", format: "uuid" },
          minValue: { type: "number", nullable: true },
          maxValue: { type: "number", nullable: true },
        },
      },
      ThresholdUpdate: {
        type: "object",
        properties: {
          minValue: { type: "number", nullable: true },
          maxValue: { type: "number", nullable: true },
        },
      },
      ThresholdDelete: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
      Zone: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          type: {
            type: "string",
            nullable: true,
            description:
              "Libelle libre du niveau (company, building, floor, room…)",
          },
          parentId: {
            type: "string",
            format: "uuid",
            nullable: true,
            description: "Zone parente (null = racine)",
          },
        },
      },
      ZoneCreate: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          type: { type: "string", nullable: true },
          parentId: { type: "string", format: "uuid", nullable: true },
        },
      },
      ZoneTreeNode: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          type: { type: "string", nullable: true },
          parentId: { type: "string", format: "uuid", nullable: true },
          sensorCount: {
            type: "integer",
            description: "Capteurs directs visibles dans la zone",
          },
          children: {
            type: "array",
            items: { $ref: "#/components/schemas/ZoneTreeNode" },
          },
        },
      },
      ZoneAccess: {
        type: "object",
        description: "Users et equipes ayant un acces direct a la zone",
        properties: {
          users: {
            type: "array",
            items: { $ref: "#/components/schemas/User" },
          },
          teams: {
            type: "array",
            items: { $ref: "#/components/schemas/Team" },
          },
        },
      },
      ZoneAccessTarget: {
        type: "object",
        description:
          "Cible d'un grant d'acces : exactement un des deux champs.",
        properties: {
          userId: { type: "string", format: "uuid" },
          teamId: { type: "string", format: "uuid" },
        },
      },
      Team: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          members: {
            type: "array",
            items: { $ref: "#/components/schemas/User" },
            description: "Present sur GET /teams/:id",
          },
          zones: {
            type: "array",
            items: { $ref: "#/components/schemas/Zone" },
            description: "Zones accordees a l'equipe (GET /teams/:id)",
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Human-readable error message",
          },
          status: { type: "integer", description: "HTTP status code" },
          codeError: {
            type: "string",
            description: "Machine-readable error code",
          },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
};

export { components };
