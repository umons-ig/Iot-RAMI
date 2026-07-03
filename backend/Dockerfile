# Stage 1: Build
FROM node:lts-slim AS builder

WORKDIR /app

# Installation des outils de compilation nécessaires pour les modules natifs (bcrypt)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock*.json ./
RUN npm ci

COPY . .
RUN npm run build

# On retire les devDependencies pour ne garder que le nécessaire pour la prod
RUN npm prune --omit=dev

# Stage 2: Production
FROM node:lts-slim

WORKDIR /home/node/app

# Le repertoire de travail est cree par WORKDIR sous root : on le rend
# accessible en ecriture a l'utilisateur node (le service ecrit dlq.json
# dans process.cwd() via dlqService).
RUN chown -R node:node /home/node/app

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# On copie les node_modules déjà installés et nettoyés depuis le builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
# On copie le code compilé
COPY --from=builder --chown=node:node /app/dist ./dist
# On copie le dossier db (migrations, seeders, config) et le .sequelizerc pour les migrations
COPY --from=builder --chown=node:node /app/src/db ./src/db
COPY --from=builder --chown=node:node /app/.sequelizerc ./
# On copie le package.json
COPY --chown=node:node package.json ./

EXPOSE 3000

# Healthcheck via Node (l'image slim n'a pas de curl) sur l'endpoint /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# On exécute le conteneur en non-root (utilisateur node fourni par l'image)
USER node

# On lance directement node
CMD ["node", "dist/server.js"]
