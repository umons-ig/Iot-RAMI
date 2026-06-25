// Swagger paths pour la ressource Teams (groupes d'utilisateurs).

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
  description: "Team UUID",
};

const paths = {
  "/teams": {
    get: {
      tags: ["Team"],
      summary: "List teams",
      operationId: "getTeams",
      security: bearer,
      responses: {
        200: {
          description: "Liste des equipes",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/Team" },
              },
            },
          },
        },
        500: { description: "Internal server error", ...jsonError },
      },
    },
    post: {
      tags: ["Team"],
      summary: "Create a team",
      operationId: "createTeam",
      security: bearer,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name"],
              properties: { name: { type: "string" } },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Equipe creee",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Team" },
            },
          },
        },
        400: { description: "name manquant", ...jsonError },
        403: { description: "Reserve aux admins", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
  },
  "/teams/{id}": {
    get: {
      tags: ["Team"],
      summary: "Get a team",
      description: "Une equipe avec ses membres et ses zones accordees.",
      operationId: "getTeam",
      security: bearer,
      parameters: [idParam],
      responses: {
        200: {
          description: "Equipe",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Team" },
            },
          },
        },
        404: { description: "Equipe introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
    put: {
      tags: ["Team"],
      summary: "Rename a team",
      operationId: "updateTeam",
      security: bearer,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name"],
              properties: { name: { type: "string" } },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Equipe mise a jour",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Team" },
            },
          },
        },
        404: { description: "Equipe introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
    delete: {
      tags: ["Team"],
      summary: "Delete a team",
      description: "Supprime l'equipe (cascade sur membres et acces de zone).",
      operationId: "deleteTeam",
      security: bearer,
      parameters: [idParam],
      responses: {
        204: { description: "Equipe supprimee" },
        404: { description: "Equipe introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
  },
  "/teams/{id}/members": {
    post: {
      tags: ["Team"],
      summary: "Add a member",
      operationId: "addTeamMember",
      security: bearer,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["userId"],
              properties: { userId: { type: "string", format: "uuid" } },
            },
          },
        },
      },
      responses: {
        201: { description: "Membre ajoute" },
        400: { description: "userId manquant", ...jsonError },
        404: { description: "Equipe ou utilisateur introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
  },
  "/teams/{id}/members/{userId}": {
    delete: {
      tags: ["Team"],
      summary: "Remove a member",
      operationId: "removeTeamMember",
      security: bearer,
      parameters: [
        idParam,
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "User UUID",
        },
      ],
      responses: {
        204: { description: "Membre retire" },
        404: { description: "Appartenance introuvable", ...jsonError },
        500: { description: "Internal server error", ...jsonError },
      },
    },
  },
};

export { paths as teamPaths };
