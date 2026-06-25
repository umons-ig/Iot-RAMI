// Swagger paths pour la ressource Zones (hierarchie de localisation + acces par zone).

const bearer = [{ bearerAuth: [] }];
const jsonError = {
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
};
const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
  description: "Zone UUID",
};

const paths = {
  "/zones": {
    get: {
      tags: ["Zone"],
      summary: "List zones",
      description: "Liste plate de toutes les zones (triees par nom).",
      operationId: "getZones",
      security: bearer,
      responses: {
        200: {
          description: "Liste des zones",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/Zone" },
              },
            },
          },
        },
        500: { description: "Internal server error", ...jsonError },
      },
    },
    post: {
      tags: ["Zone"],
      summary: "Create a zone",
      description: "Cree une zone. `parentId` null/absent = zone racine.",
      operationId: "createZone",
      security: bearer,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ZoneCreate" },
          },
        },
      },
      responses: {
        201: {
          description: "Zone creee",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Zone" },
            },
          },
        },
        400: {
          description: "name manquant ou parentId invalide",
          ...jsonError,
        },
        403: { description: "Reserve aux admins", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
  },
  "/zones/tree": {
    get: {
      tags: ["Zone"],
      summary: "Zone tree",
      description:
        "Arbre imbrique des zones avec, par noeud, le compteur de capteurs visibles par l'utilisateur courant.",
      operationId: "getZoneTree",
      security: bearer,
      responses: {
        200: {
          description: "Arbre des zones",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/ZoneTreeNode" },
              },
            },
          },
        },
        500: { description: "Internal server error", ...jsonError },
      },
    },
  },
  "/zones/{id}": {
    get: {
      tags: ["Zone"],
      summary: "Get a zone",
      description: "Une zone avec ses enfants et ses capteurs visibles.",
      operationId: "getZone",
      security: bearer,
      parameters: [idParam],
      responses: {
        200: {
          description: "Zone",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Zone" },
            },
          },
        },
        404: { description: "Zone introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
    put: {
      tags: ["Zone"],
      summary: "Update a zone",
      description:
        "Met a jour name/type/parentId. Reparenter sous un descendant est refuse (cycle).",
      operationId: "updateZone",
      security: bearer,
      parameters: [idParam],
      requestBody: {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ZoneCreate" },
          },
        },
      },
      responses: {
        200: {
          description: "Zone mise a jour",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Zone" },
            },
          },
        },
        400: { description: "parentId invalide ou cycle", ...jsonError },
        404: { description: "Zone introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
    delete: {
      tags: ["Zone"],
      summary: "Delete a zone",
      description:
        "Supprime une zone. Refuse si elle contient des sous-zones/capteurs, sauf `?cascade=true`.",
      operationId: "deleteZone",
      security: bearer,
      parameters: [
        idParam,
        {
          name: "cascade",
          in: "query",
          required: false,
          schema: { type: "boolean" },
          description: "Force la suppression du sous-arbre",
        },
      ],
      responses: {
        204: { description: "Zone supprimee" },
        400: {
          description: "Zone non vide (utiliser ?cascade=true)",
          ...jsonError,
        },
        404: { description: "Zone introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
  },
  "/zones/{id}/sensors": {
    get: {
      tags: ["Zone"],
      summary: "List zone sensors",
      description:
        "Capteurs de la zone, filtres selon l'acces de l'utilisateur.",
      operationId: "getZoneSensors",
      security: bearer,
      parameters: [idParam],
      responses: {
        200: {
          description: "Capteurs de la zone",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/Sensor" },
              },
            },
          },
        },
        404: { description: "Zone introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
    put: {
      tags: ["Zone"],
      summary: "Assign a sensor to a zone",
      description:
        "Rattache un capteur a la zone. Utiliser `:id = none` pour detacher le capteur.",
      operationId: "assignSensorToZone",
      security: bearer,
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Zone UUID, ou `none` pour detacher",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["sensorId"],
              properties: { sensorId: { type: "string", format: "uuid" } },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Capteur (re)affecte",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Sensor" },
            },
          },
        },
        400: { description: "sensorId manquant", ...jsonError },
        404: { description: "Zone ou capteur introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
  },
  "/zones/{id}/access": {
    get: {
      tags: ["Zone"],
      summary: "List zone access",
      description:
        "Users et equipes ayant un acces DIRECT a la zone (hors cascade).",
      operationId: "getZoneAccess",
      security: bearer,
      parameters: [idParam],
      responses: {
        200: {
          description: "Acces de la zone",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ZoneAccess" },
            },
          },
        },
        404: { description: "Zone introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
    post: {
      tags: ["Zone"],
      summary: "Grant zone access",
      description:
        "Accorde l'acces a la zone a un utilisateur OU une equipe (cascade sur le sous-arbre).",
      operationId: "grantZoneAccess",
      security: bearer,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ZoneAccessTarget" },
          },
        },
      },
      responses: {
        201: { description: "Acces accorde" },
        400: { description: "userId ou teamId requis", ...jsonError },
        404: { description: "Zone, user ou team introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
    delete: {
      tags: ["Zone"],
      summary: "Revoke zone access",
      description: "Retire l'acces a la zone d'un utilisateur OU d'une equipe.",
      operationId: "revokeZoneAccess",
      security: bearer,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ZoneAccessTarget" },
          },
        },
      },
      responses: {
        204: { description: "Acces retire" },
        400: { description: "userId ou teamId requis", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
  },
};

export { paths as zonePaths };
