FROM node:lts-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:lts-alpine AS production-stage
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build-stage /app/dist ./dist
# On donne la propriété des fichiers applicatifs à l'utilisateur node
RUN chown -R node:node /app
# On exécute le conteneur en non-root (utilisateur node fourni par l'image)
USER node
CMD ["node", "dist/index.js"]
